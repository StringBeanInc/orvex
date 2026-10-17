// Shared by the browser and trusted emulator backend. Monetary amounts are cents.
export type LocationFix = {
    status: 'ok' | 'denied' | 'unavailable' | 'timeout';
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    observedAt?: number;
};
export const defaultTimePolicy = { radiusFeet: 500, maxAccuracyMeters: 25, dailyMinutes: 480, weeklyMinutes: 2400, weekStartsOn: 0, timeZone: 'America/Chicago', overtimeMultiplierBps: 15000, lunchAfterMinutes: 240, lunchDurationMinutes: 30, lunchSchedule: '12:00', unpaidMeals: false, mealPolicyReference: '', gpsRetentionDays: 0, gpsAdminAccess: false };
export type TimePolicy = typeof defaultTimePolicy;
export function distanceMeters(a: {
    latitude: number;
    longitude: number;
}, b: {
    latitude: number;
    longitude: number;
}) { const rad = Math.PI / 180, dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2; return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, h))); }
export function geofence(fix: LocationFix | undefined, site: {
    latitude: number;
    longitude: number;
} | undefined, policy: TimePolicy, now: number) {
    if (!fix || fix.status !== 'ok')
        return { verified: false, reason: fix?.status || 'unavailable' };
    const { latitude, longitude, accuracy, observedAt } = fix;
    if (![latitude, longitude, accuracy, observedAt].every(Number.isFinite) || Math.abs(latitude!) > 90 || Math.abs(longitude!) > 180 || accuracy! < 0)
        return { verified: false, reason: 'invalid-fix' };
    if (now - observedAt! > 60000 || observedAt! - now > 10000)
        return { verified: false, reason: 'stale-fix' };
    if (accuracy! > policy.maxAccuracyMeters)
        return { verified: false, reason: 'poor-accuracy' };
    if (!site || !Number.isFinite(site.latitude) || !Number.isFinite(site.longitude))
        return { verified: false, reason: 'property-location-missing' };
    const distance = distanceMeters({ latitude: latitude!, longitude: longitude! }, site);
    return { verified: distance + accuracy! <= policy.radiusFeet * 0.3048 + 1e-7, reason: distance + accuracy! <= policy.radiusFeet * 0.3048 + 1e-7 ? 'inside' : 'outside-or-uncertain' };
}
export function validateTimePolicy(value: TimePolicy): TimePolicy {
    const ranges: Record<string, [
        number,
        number
    ]> = { radiusFeet: [50, 5000], maxAccuracyMeters: [1, 100], dailyMinutes: [60, 1440], weeklyMinutes: [60, 10080], weekStartsOn: [0, 6], overtimeMultiplierBps: [10000, 30000], lunchAfterMinutes: [30, 720], lunchDurationMinutes: [30, 120], gpsRetentionDays: [0, 30] };
    if (!value || Object.keys(value).sort().join() !== Object.keys(defaultTimePolicy).sort().join())
        throw Error('Invalid time policy fields.');
    for (const [k, [min, max]] of Object.entries(ranges)) {
        const n = (value as unknown as Record<string, unknown>)[k];
        if (!Number.isSafeInteger(n) || Number(n) < min || Number(n) > max)
            throw Error('Invalid ' + k);
    }
    if (typeof value.unpaidMeals !== 'boolean' || typeof value.gpsAdminAccess !== 'boolean' || typeof value.mealPolicyReference !== 'string' || value.mealPolicyReference.length > 500 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.lunchSchedule))
        throw Error('Invalid meal or GPS policy.');
    if (value.unpaidMeals && !value.mealPolicyReference.trim())
        throw Error('A reviewed jurisdiction-specific meal policy is required.');
    new Intl.DateTimeFormat('en-US', { timeZone: value.timeZone }).format();
    return { ...value };
}
export type Meal = {
    start: number;
    end: number | null;
    offDuty: boolean;
    unpaid: boolean;
};
export type TimeEntry = {
    id: string;
    companyId: string;
    technicianId: string;
    workOrderId: string;
    propertyId: string;
    start: number;
    end: number | null;
    state: 'working' | 'lunch' | 'closed';
    meals: Meal[];
    revision: number;
    rate: {
        catalogId: string;
        revision: number;
        name: string;
        internalCostCents: number | null;
        overtimeMultiplierBps: number;
    };
    policy: TimePolicy;
    flags: string[];
    correction?: {
        start: number;
        end: number;
        restoreMeals: boolean;
    };
};
export function workIntervals(entry: TimeEntry, now: number) {
    const start = entry.correction?.start ?? entry.start, end = entry.correction?.end ?? entry.end ?? now;
    let intervals: [
        [
            number,
            number
        ]
    ][number][] = [[start, Math.max(start, end)]];
    if (!entry.correction?.restoreMeals)
        for (const meal of entry.meals.filter(m => m.unpaid && m.end !== null)) {
            const a = meal.start, b = meal.end!;
            intervals = intervals.flatMap(([s, e]) => b <= s || a >= e ? [[s, e]] : [[s, Math.max(s, a)], [Math.min(e, b), e]].filter(([x, y]) => y > x) as [
                number,
                number
            ][]);
        }
    return intervals;
}
function dayKey(ms: number, zone: string) { const p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms), get = (s: string) => p.find(v => v.type === s)!.value; return `${get('year')}-${get('month')}-${get('day')}`; }
function weekKey(day: string, first: number) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - first + 7) % 7)); return d.toISOString().slice(0, 10); }
// Split at local midnight (including DST) before counting daily/weekly thresholds.
export function ledger(entries: TimeEntry[], policy: TimePolicy, now: number) {
    const days = new Map<string, number>(), weeks = new Map<string, number>(), result: Record<string, {
        workedMs: number;
        overtimeMs: number;
        costCents: number | null;
    }> = {};
    const pieces = entries.flatMap(e => workIntervals(e, now).map(([start, end]) => ({ entry: e, start, end }))).sort((a, b) => a.start - b.start);
    for (const e of entries)
        result[e.id] = { workedMs: 0, overtimeMs: 0, costCents: e.rate.internalCostCents === null ? null : 0 };
    for (const piece of pieces) {
        let s = piece.start;
        while (s < piece.end) {
            const day = dayKey(s, policy.timeZone);
            let end = piece.end;
            if (dayKey(end - 1, policy.timeZone) !== day) {
                let lo = s + 1, hi = Math.min(end, s + 27 * 3600000);
                while (lo < hi) {
                    const mid = Math.floor((lo + hi) / 2);
                    if (dayKey(mid, policy.timeZone) === day)
                        lo = mid + 1;
                    else
                        hi = mid;
                }
                end = lo;
            }
            const dk = piece.entry.technicianId + day, wk = piece.entry.technicianId + weekKey(day, policy.weekStartsOn), d = days.get(dk) || 0, w = weeks.get(wk) || 0, ms = end - s;
            // Threshold changes apply to new sessions; old entries keep their policy snapshot.
            const thresholds = piece.entry.policy ?? policy;
            const regular = Math.max(0, Math.min(ms, thresholds.dailyMinutes * 60000 - d, thresholds.weeklyMinutes * 60000 - w)), ot = ms - regular, r = result[piece.entry.id];
            r.workedMs += ms;
            r.overtimeMs += ot;
            if (r.costCents !== null)
                r.costCents += (regular * piece.entry.rate.internalCostCents! + ot * piece.entry.rate.internalCostCents! * piece.entry.rate.overtimeMultiplierBps / 10000) / 3600000;
            days.set(dk, d + ms);
            weeks.set(wk, w + ms);
            s = end;
        }
    }
    for (const r of Object.values(result))
        if (r.costCents !== null)
            r.costCents = Math.round(r.costCents);
    return result;
}
