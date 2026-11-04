import {
  ArrowRight,
  ClipboardList,
  Users,
  MapPin,
} from 'lucide-react';

import './landing.css';

export default function LandingPage() {
  return (
    <main className="landing">
      <header className="landing-header">
        <a className="landing-logo" href="/" aria-label="ORVEX home">
          <svg viewBox="55 250 1665 390" role="img" aria-label="ORVEX">
            <image
              href="/orvex-tech-logo.png"
              width="1774"
              height="887"
            />
          </svg>
        </a>

        <nav aria-label="Public navigation">
          <a href="/account?mode=login">Sign In</a>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-message">
          <p className="eyebrow">FACILITY OPERATIONS, TOGETHER</p>

          <h1>
            Your work.
            <br />
            Your team.
            <br />
            <span>One clear view.</span>
          </h1>

          <p className="landing-lead">
            Welcome to ORVEX. Bring your customers, properties,
            and field operations into a workspace built around
            your company.
          </p>

          <div className="landing-actions">
            <a className="btn primary" href="/account?mode=register">
              Create Company Account <ArrowRight size={18} />
            </a>

            <a className="btn secondary" href="/account?mode=login">
              Sign In
            </a>
          </div>

          <p className="landing-note">
            Your operations. Your team. One connected workspace.
          </p>
        </div>

        <aside className="landing-overview" aria-label="ORVEX capabilities">
          <p className="eyebrow">BUILT FOR THE WORK AHEAD</p>
          <h2>Keep operations connected.</h2>

          {[
            {
              icon: ClipboardList,
              title: 'Organize the work',
              copy: 'Manage work orders, customers, and properties in one place.',
            },
            {
              icon: Users,
              title: 'Bring your team together',
              copy: 'Keep your employees and operations connected.',
            },
            {
              icon: MapPin,
              title: 'Plan with confidence',
              copy: 'Coordinate schedules and assignments with your field team.',
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div className="landing-feature" key={title}>
              <span>
                <Icon size={22} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </div>
          ))}
        </aside>
      </section>

      <footer className="landing-footer">
        <p>ORVEX · Facility operations, simplified.</p>
      </footer>
    </main>
  );
}