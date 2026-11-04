import type {WorkOrder} from '../data';
import './work-order-card.css';

const statusClass = (status: string) => status.toLowerCase().replaceAll(' ', '-');

export type WorkOrderCardProps = {
  order: WorkOrder;
  propertyName: string;
  technicianInitials: string;
  scheduledTime: string;
  selected?: boolean;
  onSelect: () => void;
};

/**
 * The canonical, roomier presentation of a work order. Dense views will use
 * the same identity and token styles with a compact layout in a later pass.
 */
export default function WorkOrderCard({
  order,
  propertyName,
  technicianInitials,
  scheduledTime,
  selected = false,
  onSelect,
}: WorkOrderCardProps) {
  return <button type="button" className={`work-order-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <header>
      <span className={`work-order-status ${statusClass(order.status)}`}>{order.status}</span>
      <span className={`work-order-priority ${order.priority.toLowerCase()}`}>{order.priority}</span>
    </header>
    <small className="work-order-number">{order.id}</small>
    <strong>{order.title}</strong>
    <p>{propertyName}</p>
    <footer>
      <time>{scheduledTime}</time>
      <span className="work-order-assignee" aria-label="Assigned technician">{technicianInitials || '—'}</span>
    </footer>
  </button>;
}
