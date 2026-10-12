export type RecoveryMetadata={revision?:number;deletedAt?:string|null;deletedBy?:string|null;deletionReason?:string;recoverUntil?:string|null;restoredAt?:string;restoredBy?:string};
export const active=<T extends RecoveryMetadata>(records:T[])=>records.filter(r=>!r.deletedAt);
export const archive=<T extends Record<string,any>>(r:T,actor:string,reason='Removed through the application')=>({...r,deletedAt:new Date().toISOString(),deletedBy:actor,deletionReason:reason,recoverUntil:new Date(Date.now()+30*86400000).toISOString()});
