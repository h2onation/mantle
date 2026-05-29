import type { Metadata } from "next";
import "./landing.css";
import HeroRotator from "@/components/landing/HeroRotator";
import RevealInit from "@/components/landing/RevealInit";
import ContactForm from "@/components/landing/ContactForm";

export const metadata: Metadata = {
  title: "mywalnut — understanding yourself, and being understood",
  description:
    "Mywalnut helps neurodivergent adults put words to how they actually work, strengths as clearly as friction. Through conversation, what you've felt but never named becomes a working manual.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://mywalnut.app/",
    siteName: "mywalnut",
    title: "mywalnut — understanding yourself, and being understood",
    description:
      "Put words to how you actually work, strengths as clearly as friction. Built for late diagnosed autistic adults.",
  },
  twitter: {
    card: "summary_large_image",
    title: "mywalnut — understanding yourself, and being understood",
    description:
      "Put words to how you actually work, strengths as clearly as friction. Built for late diagnosed autistic adults.",
  },
};

export default function Landing() {
  return (
    <div className="mw-landing scrollable-page" data-theme="light">
      {/* Keep content visible if JS is disabled (reveal starts hidden). */}
      <noscript>
        <style>{`.mw-landing .reveal{opacity:1 !important;transform:none !important}`}</style>
      </noscript>
      <RevealInit />

      <header className="site-head">
        <div className="container">
          <span className="wordmark">
            mywalnut<span className="dot">.</span>
          </span>
          <nav className="nav">
            <a className="signin" href="/login">
              Sign in
            </a>
            <a className="nav-cta" href="#contact">
              Request beta access
            </a>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container">
            <div className="hero-grid">
              <h1 className="hero-mark reveal">
                <span>my</span>
                <HeroRotator />
                <span>walnut</span>
              </h1>
              <div className="hero-copy">
                <p className="hero-thesis reveal">
                  A different path to understanding yourself, and being
                  understood.
                </p>
                <p className="hero-lead reveal">
                  Mywalnut helps neurodivergent adults put words to how they
                  actually work, naming strengths as clearly as friction.
                  Through conversation, what you&apos;ve felt but never named
                  becomes a working manual: one that sharpens how you understand
                  yourself, and how the people who matter understand you too.
                </p>
                <a className="hero-cta reveal" href="#contact">
                  Request beta access
                </a>
              </div>
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* The gap */}
        <section className="section">
          <div className="container split">
            <div className="col-left reveal">
              <p className="eyebrow">The gap</p>
              <p className="lede">
                Picture the gap between what&apos;s happening inside you and what
                people see from the outside.
              </p>
            </div>
            <div className="col-right">
              <p className="prose stanza reveal">
                Your partner thinks you don&apos;t care. Your manager reads your
                quiet as disengagement. You keep ending up in the same
                conversation.
              </p>
              <p className="prose stanza reveal">
                Masking hides the friction. It hides the strengths just as well.
                The focus that goes deep. The patterns you catch first. The care
                that doesn&apos;t always show. All of it goes quiet together.
              </p>
              <p className="prose stanza reveal">
                Mywalnut is built for late diagnosed autistic adults, with extra
                thoughtfulness for where ADHD and dyslexia overlap. People who
                have spent years masking and want to understand the more honest
                layer of themselves.
              </p>
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* How it works */}
        <section className="section">
          <div className="container">
            <p className="eyebrow section-head reveal">How it works</p>
            <div className="steps">
              <div className="step reveal">
                <div className="step-num">1</div>
                <h3 className="step-label">Bring something in.</h3>
                <p className="step-body">
                  A conflict that keeps repeating. A reaction that surprised you.
                  A strength you can&apos;t quite name. Start the conversation.
                  Paste in a text thread or journal. Or let Jove guide you.
                </p>
              </div>
              <div className="step reveal">
                <div className="step-num">2</div>
                <h3 className="step-label">Talk it through with Jove.</h3>
                <p className="step-body">
                  A real conversation, not a questionnaire. Jove asks, listens,
                  and reflects your words back. It shows you patterns
                  you&apos;ve felt but never had words for. It never diagnoses.
                  It never tells you what to do.
                </p>
              </div>
              <div className="step reveal">
                <div className="step-num">3</div>
                <h3 className="step-label">Confirm what&apos;s true.</h3>
                <p className="step-body">
                  When Jove names a pattern that fits, you confirm it. Then it
                  goes in your Manual. Nothing is added without your sign off.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* What you build */}
        <section className="section">
          <div className="container split">
            <div className="col-left reveal">
              <p className="eyebrow">What you build</p>
              <h2>The Manual</h2>
              <p className="prose">
                A living document you build over time, in your own voice. It
                holds your strengths and your friction equally.
              </p>
            </div>
            <div className="col-right reveal">
              <ul className="layers">
                <li>
                  <span className="ln">01</span>
                  <span>The patterns people misread</span>
                </li>
                <li>
                  <span className="ln">02</span>
                  <span>How you process</span>
                </li>
                <li>
                  <span className="ln">03</span>
                  <span>What helps you function</span>
                </li>
                <li>
                  <span className="ln">04</span>
                  <span>How you show up with people</span>
                </li>
                <li>
                  <span className="ln">05</span>
                  <span>Where you&apos;re strong</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* What makes it different */}
        <section className="section">
          <div className="container">
            <p className="eyebrow section-head reveal">What makes it different</p>
            <div className="cards">
              <div className="card reveal">
                <h3>Sees what goes unsaid</h3>
                <p>
                  It reads how you tell a story, not just the facts. It catches
                  what you&apos;d never think to mention.
                </p>
              </div>
              <div className="card reveal">
                <h3>Connects patterns that might be difficult to see</h3>
                <p>
                  It links what comes up across your conversations. It shows
                  patterns too scattered to spot on your own.
                </p>
              </div>
              <div className="card reveal">
                <h3>Strengths, not just struggles</h3>
                <p>
                  It surfaces what you do well and where to lean in. Your
                  strengths get named as carefully as your friction.
                </p>
              </div>
              <div className="card reveal">
                <h3>Share to be understood</h3>
                <p>
                  Share your Manual as a page you control. The people you choose
                  read it. They finally understand how you work.
                </p>
              </div>
              <div className="card card-wide reveal">
                <h3>Meets you where it&apos;s easiest</h3>
                <p>
                  Use Mywalnut on mobile, on desktop, or by text. Start wherever
                  and whenever works for you.
                </p>
              </div>
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* Why walnut */}
        <section className="section">
          <div className="container">
            <div className="center reveal">
              <p className="eyebrow">Why walnut</p>
              <p className="lede">A walnut looks like a lovely little brain.</p>
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* Get in touch */}
        <section className="section" id="contact">
          <div className="container split">
            <div className="col-left reveal">
              <p className="eyebrow">Get in touch</p>
              <h2>One inbox.</h2>
              <p className="prose">
                Reach out about beta access, questions, press, or just
                curiosity. We&apos;re building this with the community, and
                eagerly welcome your feedback.
              </p>
            </div>
            <div className="col-right reveal">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <hr className="rule" />

      <footer>
        <div className="container">
          <p className="foot-id">
            <span>mywalnut,&nbsp;Inc.</span>
            <span className="sep">·</span>
            <span>mywalnut.app</span>
            <span className="sep">·</span>
            <a href="mailto:jeff@mywalnut.app">jeff@mywalnut.app</a>
          </p>
          <p className="foot-legal">
            Mywalnut is a self understanding tool, not a therapy, diagnostic, or
            clinical service. If you&apos;re in crisis, contact 988 or text HOME
            to 741741.
          </p>
        </div>
      </footer>
    </div>
  );
}
