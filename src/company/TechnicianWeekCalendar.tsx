
import { useState } from 'react';
import type {
  CompanyEmployee,
  CompanyWorkOrder,
} from './workOrderModel';

type Props = {
  employees: CompanyEmployee[];
  orders: CompanyWorkOrder[];
  weekDays: Date[];
  selectedDate: string;
  onSelectDate: (date: Date) => void;
};

type SelectedCell = {
  technicianId: string;
  date: string;
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function TechnicianWeekCalendar({
  employees,
  orders,
  weekDays,
  onSelectDate,
}: Props) {
  const [selectedCell, setSelectedCell] =
    useState<SelectedCell | null>(null);

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const selectedEmployee = employees.find(
    employee => employee.id === selectedCell?.technicianId
  );

  const selectedOrder = orders.find(
    order => order.id === selectedOrderId
  );

  const selectedAssignments = selectedCell
    ? orders.filter(
        order =>
          order.assignedTechnicianId === selectedCell.technicianId &&
          order.scheduledDate === selectedCell.date
      )
    : [];

  function selectCell(employeeId: string, date: Date) {
    const key = dateKey(date);

    setSelectedCell({
      technicianId: employeeId,
      date: key,
    });

    setSelectedOrderId(null);
    onSelectDate(date);
  }

  function selectOrder(
    order: CompanyWorkOrder,
    employeeId: string,
    date: Date
  ) {
    setSelectedCell({
      technicianId: employeeId,
      date: dateKey(date),
    });

    setSelectedOrderId(order.id);
    onSelectDate(date);
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ minWidth: 1100 }}>
          {/* Weekday headings */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '190px repeat(7, minmax(125px, 1fr))',
              gap: 4,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                padding: 12,
                fontWeight: 700,
              }}
            >
              Technician
            </div>

            {weekDays.map(date => (
              <div
                key={dateKey(date)}
                style={{
                  padding: 12,
                  textAlign: 'center',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  borderRadius: 6,
                }}
              >
                <strong>
                  {date.toLocaleDateString(undefined, {
                    weekday: 'short',
                  })}
                </strong>

                <div>{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Individual technician rows */}
          {employees.map(employee => (
            <div
              key={employee.id}
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '190px repeat(7, minmax(125px, 1fr))',
                gap: 4,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  padding: 12,
                  background: '#f1f5f9',
                  color: '#0f172a',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                {employee.name}
              </div>

              {weekDays.map(date => {
                const key = dateKey(date);

                const assignments = orders.filter(
                  order =>
                    order.assignedTechnicianId === employee.id &&
                    order.scheduledDate === key
                );

                const isSelected =
                  selectedCell?.technicianId === employee.id &&
                  selectedCell?.date === key;

                return (
                  <div
                    key={key}
                    style={{
                      minHeight: 150,
                      maxHeight: 260,
                      overflowY: 'auto',
                      padding: 6,
                      border: isSelected
                        ? '2px solid #2563eb'
                        : '1px solid #e2e8f0',
                      background: isSelected
                        ? '#eff6ff'
                        : '#ffffff',
                      borderRadius: 6,
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Work orders */}
                    {assignments.map(order => {
                      const isOrderSelected =
                        selectedOrderId === order.id;

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() =>
                            selectOrder(order, employee.id, date)
                          }
                          title={`${order.title} - ${order.status}`}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: 8,
                            marginBottom: 5,
                            border: isOrderSelected
                              ? '2px solid #1d4ed8'
                              : '1px solid transparent',
                            borderLeft: '3px solid #2563eb',
                            borderRadius: 4,
                            background: isOrderSelected
                              ? '#bfdbfe'
                              : '#dbeafe',
                            color: '#1e3a8a',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          <strong
                            style={{
                              display: 'block',
                              fontSize: 12,
                            }}
                          >
                            {order.title}
                          </strong>

                          <small>{order.status}</small>
                        </button>
                      );
                    })}

                    {/* Select this technician and date */}
                    <button
                      type="button"
                      onClick={() =>
                        selectCell(employee.id, date)
                      }
                      style={{
                        width: '100%',
                        padding: 8,
                        background: 'transparent',
                        color: isSelected
                          ? '#1d4ed8'
                          : '#64748b',
                        border: isSelected
                          ? '1px dashed #2563eb'
                          : '1px dashed #cbd5e1',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {isSelected
                        ? 'Selected'
                        : '+ Select box'}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          {employees.length === 0 && (
            <p style={{ padding: 16 }}>
              No active technicians available.
            </p>
          )}
        </div>
      </div>

      {/* Details for the individually selected box */}
      {selectedCell && (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                {selectedEmployee?.name ?? 'Technician'}
              </h3>

              <p style={{ margin: '6px 0' }}>
                {new Date(
                  `${selectedCell.date}T12:00:00`
                ).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCell(null);
                setSelectedOrderId(null);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>

          <p>
            <strong>
              {selectedAssignments.length}
            </strong>{' '}
            work orders scheduled
          </p>

          {selectedOrder ? (
            <div
              style={{
                padding: 12,
                background: '#eff6ff',
                color: '#1e3a8a',
                borderRadius: 6,
                marginTop: 12,
              }}
            >
              <strong>{selectedOrder.title}</strong>

              <p>Status: {selectedOrder.status}</p>
              <p>Priority: {selectedOrder.priority}</p>
              <p>
                Service: {selectedOrder.serviceCategory}
              </p>

              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
              >
                Back to daily assignments
              </button>
            </div>
          ) : (
            <div>
              {selectedAssignments.length === 0 ? (
                <p>No work orders for this technician on this day.</p>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  {selectedAssignments.map(order => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() =>
                        setSelectedOrderId(order.id)
                      }
                      style={{
                        padding: 12,
                        textAlign: 'left',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <strong>{order.title}</strong>

                      <div>
                        {order.status} · {order.priority}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
