import {
  Gift,
  ListChecks,
  LockKeyhole,
  MailPlus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { firebaseApp } from "./lib/firebase";

const familyMembers = [
  { name: "Anna", wishes: 4, unclaimed: 3, kind: "Adult" },
  { name: "Ben", wishes: 2, unclaimed: 1, kind: "Adult" },
  { name: "Lili", wishes: 5, unclaimed: 4, kind: "Managed child" },
];

const visibleWishes = [
  { title: "Board game night set", claimed: false },
  { title: "Warm reading lamp", claimed: true },
  { title: "Sketchbook and pens", claimed: false },
];

const giftIdeas = [
  { title: "Pottery class", claimed: false },
  { title: "Museum membership", claimed: true },
];

export function App() {
  const projectId = firebaseApp.options.projectId ?? "local emulator";

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Family navigation">
        <div className="brand">
          <Gift aria-hidden="true" />
          <span>Wishlist</span>
        </div>

        <button className="primary-action" type="button">
          <MailPlus aria-hidden="true" />
          Invite
        </button>

        <nav className="nav-list" aria-label="Main">
          <a className="nav-item active" href="#family">
            <Users aria-hidden="true" />
            Family
          </a>
          <a className="nav-item" href="#wishes">
            <ListChecks aria-hidden="true" />
            My wishes
          </a>
          <a className="nav-item" href="#claims">
            <ShieldCheck aria-hidden="true" />
            My claims
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Smith Family</p>
            <h1>Christmas wishes</h1>
          </div>
          <div className="privacy-pill">
            <LockKeyhole aria-hidden="true" />
            Surprise privacy enforced
          </div>
        </header>

        <section className="summary-grid" aria-label="Family summary">
          <div className="metric-card">
            <span className="metric-value">3</span>
            <span className="metric-label">members</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">11</span>
            <span className="metric-label">visible wishes</span>
          </div>
          <div className="metric-card">
            <span className="metric-value">8</span>
            <span className="metric-label">unclaimed</span>
          </div>
        </section>

        <div className="content-grid">
          <section className="panel" id="family">
            <div className="panel-header">
              <h2>Family</h2>
              <button className="secondary-action" type="button">
                Add child profile
              </button>
            </div>

            <div className="member-list">
              {familyMembers.map((member) => (
                <article className="member-row" key={member.name}>
                  <div>
                    <h3>{member.name}</h3>
                    <p>{member.kind}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Wishes</dt>
                      <dd>{member.wishes}</dd>
                    </div>
                    <div>
                      <dt>Open</dt>
                      <dd>{member.unclaimed}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="panel" id="wishes">
            <div className="panel-header">
              <h2>Anna's list</h2>
              <button className="secondary-action" type="button">
                Add gift idea
              </button>
            </div>

            <div className="wish-list">
              {visibleWishes.map((wish) => (
                <article className="wish-row" key={wish.title}>
                  <span>{wish.title}</span>
                  <button
                    className={wish.claimed ? "claim claimed" : "claim"}
                    type="button"
                  >
                    {wish.claimed ? "Claimed" : "Claim"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel secret-panel">
            <div className="panel-header">
              <h2>Hidden ideas</h2>
              <span className="hidden-label">Not visible to Anna</span>
            </div>

            <div className="wish-list">
              {giftIdeas.map((idea) => (
                <article className="wish-row" key={idea.title}>
                  <span>{idea.title}</span>
                  <button
                    className={idea.claimed ? "claim claimed" : "claim"}
                    type="button"
                  >
                    {idea.claimed ? "Claimed" : "Claim"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="status-line">
          Firebase project: <code>{projectId}</code>
        </footer>
      </section>
    </main>
  );
}
