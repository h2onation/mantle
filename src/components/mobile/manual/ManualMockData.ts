export interface Pattern {
  id: string;
  name: string;
  description: string;
}

export interface LayerComponent {
  narrative: string; // Full text, paragraphs separated by \n\n
}

export interface Layer {
  id: number;
  name: string;
  about: string;
  component: LayerComponent | null;
  patterns: Pattern[];
  isNew?: boolean;
}

const LAYER_DEFINITIONS: Layer[] = [
  {
    id: 1,
    name: "What Drives You",
    about: "Your core needs and values \u2014 the things you organize your life around, often without realizing it. When these are met, you feel grounded. When they\u2019re threatened, your patterns activate.",
    component: {
      narrative: "You operate from a deep need to be seen as competent and self-sufficient. Independence isn\u2019t a preference \u2014 it\u2019s a condition for feeling safe. You\u2019ll absorb unreasonable workloads before asking for help, not because you believe you should do everything alone, but because needing help feels like evidence of inadequacy.\n\nUnderneath this sits a competing need: to matter to people beyond your utility. You want to be valued for who you are, not just what you produce. But you\u2019ve built a life where your value proposition is your output \u2014 so the thing you want most is the thing your system makes hardest to test.\n\nYour values center on integrity, depth, and earned trust. You have low tolerance for performative relationships, shortcuts, or surface-level engagement. You\u2019d rather have three people who genuinely know you than a hundred who know your resume. This is a strength until it becomes a filter that screens out connection before it can start."
    },
    patterns: [
      { id: "p1", name: "The Hidden Investment", description: "You protect what matters most by pretending it doesn\u2019t matter at all. When something you care about meets resistance, you suppress your investment in real time \u2014 then the resentment surfaces privately, often days later." },
      { id: "p2", name: "The Competence Trap", description: "You take on more than your share to prove you can handle it. The cycle reinforces itself: the more you absorb, the more people rely on you, the more absorbing feels mandatory." }
    ]
  },
  {
    id: 2,
    name: "Your Self Perception",
    about: "How you see yourself \u2014 the beliefs you hold about who you are, what you deserve, and what you\u2019re capable of. These beliefs act as filters on everything you experience.",
    component: {
      narrative: "You carry two self-images that don\u2019t resolve. The first is someone who is sharp, capable, and quietly excellent \u2014 someone who earns respect through the quality of their thinking. The second is someone who is fundamentally too much and simultaneously not enough.\n\nThe first image drives your professional identity. You trust your judgment, take pride in your work, and hold yourself to standards most people wouldn\u2019t attempt. This isn\u2019t arrogance \u2014 it\u2019s the part of you that knows what you\u2019re capable of when the conditions are right.\n\nThe second image lives closer to the surface than you\u2019d like. It shows up when you\u2019re vulnerable: when you\u2019ve been too honest, too emotional, too visibly invested. In those moments, you don\u2019t just feel exposed \u2014 you feel like you\u2019ve confirmed something about yourself that you work hard to keep hidden. The gap between these two images is where most of your internal tension lives."
    },
    patterns: [
      { id: "p3", name: "The Retraction Reflex", description: "After moments of genuine vulnerability, you immediately wish you could take it back. The exposure itself becomes the problem, regardless of how the other person actually responded." }
    ]
  },
  {
    id: 3,
    name: "Your Reaction System",
    about: "How you process pressure, conflict, and emotional intensity. The internal operating system that activates when things get difficult \u2014 your default responses before conscious choice kicks in.",
    component: {
      narrative: "Under pressure, your first move is to intellectualize. You convert emotional experiences into analytical problems \u2014 not to avoid feeling, but because understanding feels like the only form of control available to you.\n\nYour reaction system has a distinctive sequence: a brief window of genuine emotional response (often surprise or hurt), followed by rapid cognitive override. You move to analysis so quickly that the original feeling barely registers \u2014 and when it does surface later, it arrives as physical tension, insomnia, or displaced irritation rather than the original emotion.\n\nYour protective strategies are sophisticated. You don\u2019t stonewall or explode. You become more articulate, more measured, more helpful. The defense is so well-constructed that others often can\u2019t tell you\u2019re defending at all."
    },
    patterns: [
      { id: "p4", name: "The Articulate Shield", description: "When emotionally activated, you become more precise and helpful rather than less. Others experience your composure as strength. You experience it as the only option." }
    ]
  },
  {
    id: 4,
    name: "How You Operate",
    about: "Your functional patterns \u2014 how you think, decide, manage energy, and handle complexity. The day-to-day machinery of how you move through the world.",
    component: {
      narrative: "You think in systems. When presented with a problem, you instinctively map the full landscape before acting \u2014 dependencies, second-order effects, edge cases. This makes you exceptionally thorough and occasionally paralyzed.\n\nYour energy management follows a boom-and-bust pattern. You can sustain extraordinary output for extended periods, fueled by engagement and the satisfaction of visible progress. But you have weak signals for depletion. By the time you notice you\u2019re running low, you\u2019re already in deficit \u2014 and recovery takes longer than it should because you treat rest as something to earn rather than something to schedule."
    },
    patterns: [
      { id: "p5", name: "The Completeness Compulsion", description: "You struggle to ship at 80%. The gap between good enough and your standard feels like negligence, so you invest the final 20% even when the return doesn\u2019t justify it." }
    ]
  },
  {
    id: 5,
    name: "Your Relationship to Others",
    about: "How you connect, communicate, build trust, and repair. The relational layer \u2014 how others actually experience you, and the patterns that play out between people.",
    component: {
      narrative: "You are experienced by others as warm, competent, and slightly unreachable. People trust your judgment and seek your input, but few feel they truly know you. This is not accidental.\n\nYour communication style is precise and considered. You listen actively, ask good questions, and give thoughtful responses. What you rarely do is volunteer information about your own internal state. Others learn what you think, not what you feel. Over time, this creates a relational pattern where people feel respected by you but not fully connected to you."
    },
    patterns: [
      { id: "p6", name: "The Accessible Distance", description: "You create relationships where others feel comfortable bringing you their problems but rarely feel invited to ask about yours. The asymmetry feels natural to you and lonely to them." }
    ]
  }
];

function makeEmpty(layer: typeof LAYER_DEFINITIONS[number]): Layer {
  return { ...layer, component: null, patterns: [] };
}

export function getEmptyState(): Layer[] {
  return LAYER_DEFINITIONS.map(makeEmpty);
}

export function getPartialState(): Layer[] {
  return LAYER_DEFINITIONS.map((layer) => {
    if (layer.id <= 2) return { ...layer };
    return makeEmpty(layer);
  });
}

export function getUpdatedState(): Layer[] {
  return LAYER_DEFINITIONS.map((layer) => {
    if (layer.id === 1) return { ...layer };
    if (layer.id === 2) return { ...layer, isNew: true };
    return makeEmpty(layer);
  });
}

export function getMatureState(): Layer[] {
  return LAYER_DEFINITIONS.map((layer) => ({ ...layer }));
}
