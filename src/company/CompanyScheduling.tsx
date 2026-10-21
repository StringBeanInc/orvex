
import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from 'lucide-react';

import { loadWorkOrders } from './workOrderRepository';
import type {
  CompanyEmployee,
  CompanyWorkOrder,
} from './workOrderModel';

import CompanyWorkOrders from './CompanyWorkOrders';
import TechnicianWeekCalendar from './TechnicianWeekCalendar';

type CalendarView = 'Day' | 'Week' | 'Month';

type SavedView = {
  id: string;
  name: string;
  showWeekends: boolean;
  weekStartsMonday: boolean;
};

const pad = (value: number) => String(value).padStart(2, '0');

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDate = (value: string) => new Date(`${value}T12:00:00`);

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const weekStart = (date: Date, monday: boolean) =>
  addDays(date, -(monday ? (date.getDay() + 6) % 7 : date.getDay()));

const preferenceKey = (companyId: string) =>
  `orvex.calendar.views.${companyId}`;

type Props = {
  companyId: string;
  readOnly: boolean;
  createRequest: {
    id: string;
    propertyId: string;
    customerId: string;
  } | null;
  onCreateRequestOpened: () => void;
};

export default function CompanyScheduling({
  companyId,
  readOnly,
  createRequest,
  onCreateRequestOpened,
}: Props) {
  const today = new Date();

  const [view, setView] = useState<CalendarView>('Week');
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [cursor, setCursor] = useState(today);
  const [showWeekends, setShowWeekends] = useState(true);
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState('');

  const [orders, setOrders] = useState<CompanyWorkOrder[]>([]);
  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sequence = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(preferenceKey(companyId)) || '[]'
      );

      if (Array.isArray(saved)) {
        setSavedViews(
          saved.filter(
            (item): item is SavedView =>
              typeof item?.id === 'string' &&
              typeof item?.name === 'string' &&
              typeof item?.showWeekends === 'boolean' &&
              typeof item?.weekStartsMonday === 'boolean'
          )
        );
      }
    } catch {
      setSavedViews([]);
    }
  }, [companyId]);

  function persist(next: SavedView[]) {
    setSavedViews(next);
    localStorage.setItem(preferenceKey(companyId), JSON.stringify(next));
  }

  async function reload() {
    const current = ++sequence.current;

    setLoading(true);
    setError('');

    try {
      const data = await loadWorkOrders(companyId);

      if (current === sequence.current) {
        setOrders(data.orders);
        setEmployees(
          data.employees.filter(employee => employee.active !== false)
        );
      }
    } catch (e) {
      if (current === sequence.current) {
        setError(
          e instanceof Error ? e.message : 'Unable to load scheduled work.'
        );
      }
    } finally {
      if (current === sequence.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void reload();

    return () => {
      sequence.current++;
    };
  }, [companyId]);

  const visibleOrders = selectedTechnicians.length
    ? orders.filter(order =>
        selectedTechnicians.includes(order.assignedTechnicianId)
      )
    : orders;

  const visibleEmployees = selectedTechnicians.length
    ? employees.filter(employee =>
        selectedTechnicians.includes(employee.id)
      )
    : employees;

  const dayOrders = (value: string) =>
    visibleOrders
      .filter(order => order.scheduledDate === value)
      .sort(
        (a, b) =>
          a.priority.localeCompare(b.priority) ||
          a.title.localeCompare(b.title)
      );

  function toggleTechnician(id: string) {
    setSelectedTechnicians(selected =>
      selected.includes(id)
        ? selected.filter(value => value !== id)
        : [...selected, id]
    );
  }

  const selectedOrders = dayOrders(selectedDate);
  const visibleDays = showWeekends ? 7 : 5;

  const weekDays = Array.from(
    { length: visibleDays },
    (_, index) =>
      addDays(
        weekStart(parseDate(selectedDate), weekStartsMonday),
        index
      )
  );

  const isVisible = (date: Date) =>
    showWeekends || (date.getDay() > 0 && date.getDay() < 6);

  const firstOfMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    1
  );

  const firstVisible = (() => {
    let date = new Date(firstOfMonth);

    while (!isVisible(date)) {
      date = addDays(date, 1);
    }

    return date;
  })();

  const offset = weekStartsMonday
    ? (firstVisible.getDay() + 6) % 7
    : firstVisible.getDay();

  const lastDay = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0
  ).getDate();

  const monthDates: Array<Date | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: lastDay },
      (_, index) =>
        new Date(cursor.getFullYear(), cursor.getMonth(), index + 1)
    ).filter(isVisible),
  ];

  const labels = (
    weekStartsMonday
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  ).slice(0, visibleDays);

  function choose(date: Date) {
    setSelectedDate(dateKey(date));
    setCursor(date);

    if (view === 'Month') {
      setView('Day');
    }
  }

  function move(amount: number) {
    const anchor =
      view === 'Month' ? cursor : parseDate(selectedDate);

    const shift =
      view === 'Month'
        ? new Date(
            anchor.getFullYear(),
            anchor.getMonth() + amount,
            1
          )
        : addDays(
            anchor,
            amount * (view === 'Week' ? 7 : 1)
          );

    if (view === 'Month') {
      setCursor(shift);
    } else {
      setSelectedDate(dateKey(shift));
      setCursor(shift);
    }
  }

  function saveLayout() {
    const name = viewName.trim();

    if (!name) return;

    persist([
      ...savedViews,
      {
        id: crypto.randomUUID(),
        name,
        showWeekends,
        weekStartsMonday,
      },
    ]);

    setViewName('');
  }

  function title() {
    if (view === 'Month') {
      return cursor.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }

    if (view === 'Week') {
      const start = weekDays[0];
      const end = weekDays[weekDays.length - 1];

      return `${start.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} – ${end.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    }

    return parseDate(selectedDate).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function dayCell(
    date: Date,
    compact = false,
    hideHeader = false
  ) {
    const value = dateKey(date);
    const items = dayOrders(value);
    const limit = compact ? 3 : 5;

    return (
      <button
        key={value}
        type="button"
        className={`assignment-day ${
          selectedDate === value ? 'selected' : ''
        } ${compact ? 'month-cell' : ''} ${
          hideHeader ? 'week-cell' : ''
        }`}
        aria-pressed={selectedDate === value}
        onClick={() => choose(date)}
      >
        {!hideHeader && (
          <header>
            <strong>{date.getDate()}</strong>
            <span>{items.length || ''}</span>
          </header>
        )}

        <div>
          {items.slice(0, limit).map(order => (
            <span
              className={`assignment-chip priority-${order.priority.toLowerCase()}`}
              key={order.id}
              title={`${order.title} · ${order.status}`}
            >
              {order.title}
            </span>
          ))}

          {items.length > limit && (
            <small>+{items.length - limit} more</small>
          )}

          {hideHeader && items.length === 0 && (
            <small className="week-empty">No assignments</small>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="company-scheduling redesigned-scheduling">
      <section className="schedule-shell">
        <div className="schedule-toolbar">
          <div className="schedule-period">
            <button
              className="icon-btn"
              aria-label="Previous calendar period"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={18} />
            </button>

            <strong>{title()}</strong>

            <button
              className="icon-btn"
              aria-label="Next calendar period"
              onClick={() => move(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div
            className="schedule-view-switch"
            aria-label="Calendar view"
          >
            {(['Day', 'Week', 'Month'] as CalendarView[]).map(
              option => (
                <button
                  key={option}
                  className={view === option ? 'selected' : ''}
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  {option}
                </button>
              )
            )}
          </div>

          <button
            className="btn secondary"
            disabled={loading}
            onClick={() => void reload()}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="schedule-body">
          <section
            className="calendar-canvas"
            aria-label={`${view} scheduling calendar`}
          >
            {view === 'Day' ? (
              <div className="day-agenda">
                <p className="eyebrow">
                  {parseDate(selectedDate).toLocaleDateString(
                    undefined,
                    { weekday: 'long' }
                  )}
                </p>

                <h2>
                  {parseDate(selectedDate).toLocaleDateString(
                    undefined,
                    { month: 'long', day: 'numeric' }
                  )}
                </h2>

                {selectedOrders.length ? (
                  <div className="agenda-list">
                    {selectedOrders.map(order => (
                      <article
                        key={order.id}
                        className={`agenda-job priority-${order.priority.toLowerCase()}`}
                      >
                        <strong>{order.title}</strong>
                        <span>
                          {order.status} · {order.priority} priority
                        </span>
                        <small>{order.serviceCategory}</small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="schedule-empty">
                    No work orders are scheduled for this day.
                  </p>
                )}
              </div>
            ) : view === 'Week' ? (
              <TechnicianWeekCalendar
                employees={visibleEmployees}
                orders={visibleOrders}
                weekDays={weekDays}
                selectedDate={selectedDate}
                onSelectDate={choose}
              />
            ) : (
              <div
                className="month-canvas"
                style={{
                  gridTemplateColumns: `repeat(${visibleDays},minmax(118px,1fr))`,
                }}
              >
                {labels.map(label => (
                  <span className="month-label" key={label}>
                    {label}
                  </span>
                ))}

                {monthDates.map((date, index) =>
                  date ? (
                    dayCell(date, true)
                  ) : (
                    <span key={`blank-${index}`} />
                  )
                )}
              </div>
            )}
          </section>

          <aside className="schedule-agenda">
            <div>
              <p className="eyebrow">Selected day</p>
              <h2>
                {parseDate(selectedDate).toLocaleDateString(
                  undefined,
                  { month: 'short', day: 'numeric' }
                )}
              </h2>
            </div>

            <div className="agenda-count">
              {selectedOrders.length} assigned
            </div>

            {selectedOrders.length ? (
              <ol>
                {selectedOrders.map(order => (
                  <li key={order.id}>
                    <strong>{order.title}</strong>
                    <span>{order.status}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="subtle">
                Nothing assigned to this day.
              </p>
            )}

            <section
              className="schedule-technicians"
              aria-label="Technician schedule filters"
            >
              <div>
                <p className="eyebrow">Technicians</p>
                <strong>{employees.length} available</strong>
              </div>

              <button
                className="text-btn"
                disabled={!selectedTechnicians.length}
                onClick={() => setSelectedTechnicians([])}
              >
                Show all
              </button>

              {employees.length ? (
                <div className="technician-filter-list">
                  {employees.map(employee => {
                    const checked =
                      selectedTechnicians.includes(employee.id);

                    const assigned = orders.filter(
                      order =>
                        order.assignedTechnicianId === employee.id &&
                        order.scheduledDate
                    ).length;

                    return (
                      <label key={employee.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleTechnician(employee.id)
                          }
                        />

                        <span>
                          <strong>{employee.name}</strong>
                          <small>{assigned} scheduled</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="subtle">
                  No active technicians available.
                </p>
              )}
            </section>

            <details className="calendar-settings">
              <summary>
                <SlidersHorizontal size={15} />
                Calendar settings
              </summary>

              <label>
                <input
                  type="checkbox"
                  checked={showWeekends}
                  onChange={event =>
                    setShowWeekends(event.target.checked)
                  }
                />
                Show Saturday and Sunday
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={weekStartsMonday}
                  onChange={event =>
                    setWeekStartsMonday(event.target.checked)
                  }
                />
                Start weeks on Monday
              </label>

              <div className="save-layout">
                <input
                  aria-label="Saved weekly layout name"
                  placeholder="Save this weekly layout"
                  maxLength={60}
                  value={viewName}
                  onChange={event =>
                    setViewName(event.target.value)
                  }
                />

                <button
                  className="btn secondary"
                  disabled={!viewName.trim()}
                  onClick={saveLayout}
                >
                  <Save size={15} />
                  Save
                </button>
              </div>

              {savedViews.length > 0 && (
                <select
                  aria-label="Saved weekly layouts"
                  defaultValue=""
                  onChange={event => {
                    const saved = savedViews.find(
                      item => item.id === event.target.value
                    );

                    if (saved) {
                      setShowWeekends(saved.showWeekends);
                      setWeekStartsMonday(saved.weekStartsMonday);
                      setView('Week');
                    }
                  }}
                >
                  <option value="">
                    Saved weekly layouts
                  </option>

                  {savedViews.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
            </details>
          </aside>
        </div>

        {loading && (
          <p role="status" className="schedule-status">
            Loading scheduled work…
          </p>
        )}

        {error && (
          <p role="alert" className="warning">
            {error}
          </p>
        )}
      </section>

      <details className="schedule-manager">
        <summary>
          <span>
            <strong>Manage work orders</strong>
            <small>
              Create work orders and set scheduled dates.
            </small>
          </span>
        </summary>

        <CompanyWorkOrders
          companyId={companyId}
          readOnly={readOnly}
          canPrice={false}
          createRequest={createRequest}
          onCreateRequestOpened={onCreateRequestOpened}
        />
      </details>
    </div>
  );
}
