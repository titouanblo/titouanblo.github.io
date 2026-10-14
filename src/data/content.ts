export interface Entry {
  title: string;
  meta?: string;
  date?: string;
  // Always visible, even when the entry is closed.
  lead?: string;
  text?: string;
  points?: string[];
  href?: string;
  // Link to a written report or paper.
  paper?: string;
}

export interface Section {
  id: string;
  label: string;
  entries: Entry[];
  compact?: boolean;
  // Entries show their title only and open on click to reveal the details.
  expand?: boolean;
  // Short labelled paragraphs, used by the About section.
  about?: { label: string; text: string }[];
  note?: string;
}

const gh = (repo: string) => `https://github.com/titouanblo/${repo}`;

export const profile = {
  name: 'Titouan Blossier',
  // Browser tab and search result title: the name first, then what a searcher needs to recognise the person.
  title: 'Titouan Blossier · École Polytechnique (X24), Applied Math and AI',
  role: 'Student at École Polytechnique (X24)',
  intro: 'Specializing in Applied Math and Artificial Intelligence',
  // The two lines Google shows under the title: kept under about 155 characters so it is not cut off.
  snippet: 'Titouan Blossier, student at École Polytechnique (X24) in Applied Math and AI. Software Engineer Intern at Google in 2026. Research and coding projects.',
  // Plain factual summary for search engines and AI assistants (meta description, structured data, /llms.txt).
  summary:
    'Titouan Blossier is a student at École Polytechnique (X24) specializing in Applied Mathematics and Artificial Intelligence, with a minor in Computer Science. Software Engineer Intern at Google in 2026, research on generative models for Bayesian inverse problems, and personal software projects since 2019.',
  topics: ['Artificial intelligence', 'Applied mathematics', 'Deep learning', 'Computer vision', 'Generative models', 'Software engineering'],
  links: [
    { label: 'GitHub', href: 'https://github.com/titouanblo' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/titouan-blossier-10ba4a330/' },
  ],
  // Written out so that address harvesters cannot read it; never add a mailto link.
  email: 'titouan [dot] blossier [at] polytechnique [dot] edu',
};

// Wording follows main.cv. Keep the two in step when either changes.
export const sections: Section[] = [
  {
    id: 'about',
    label: 'About me',
    entries: [],
    about: [
      {
        label: 'Path',
        text: 'I grew up in Brittany (France) and started coding at ten. After two years of classes préparatoires in Nantes I entered École Polytechnique, which began with six months as an officer cadet in the French Navy. I spent the summer of 2026 as a software engineer at Google, and I am now in my third year, studying Applied Mathematics and AI.',
      },
      {
        label: 'Drive',
        text: 'I like bringing projects to life and leading the teams behind them. I chaired the organization of a 200-person adventure race with a team of 15, and I manage client projects at my school’s student-run consulting firm. It started early: at fourteen I created a YouTube channel of coding tutorials, grew its community to 800 members and recruited a team to help me run it.',
      },
      {
        label: 'Sports',
        text: 'I routinely run, bike and play racket sports, alongside kitesurfing, skiing and hiking, which led me to complete a Half Ironman.',
      },
    ],
  },
  {
    id: 'work',
    label: 'Work experience',
    expand: true,
    entries: [
      {
        title: 'Google, Software Engineer Intern',
        meta: 'Content Safety Team, under the supervision of Damian Kowalik',
        date: 'Jun 2026 – Sep 2026',
        text: 'Improved the internal software used by Analysts to detect AI abuse schemes.',
        points: [
          'Designed and implemented an agentic workflow to increase Analysts’ efficiency.',
          'Resolved a long-standing translation issue by redesigning the underlying translation pipeline.',
          'Increased efficiency tenfold, ensuring continued scaling for Gemini.',
          'Cut translation error rate from 40% to 2% and average latency from 8s to 1s.',
        ],
      },
      {
        title: 'French Navy, Leadership Training, Officer Cadet',
        meta: 'Part of École Polytechnique’s first-year curriculum',
        date: '2024 – 2025',
        points: [
          'Officer of the watch (OOW) on board the frigate Germinal.',
          'Leading counter-drug operations in the Western Atlantic and Caribbean.',
          'Taught math and physics for enlisted personnel preparing internal examinations.',
        ],
      },
      {
        title: 'Student Societies',
        meta: 'École Polytechnique',
        date: '2024 – 2026',
        points: [
          'Adventure Racing Association, Chair: led a team of 15 in the organization of a 200-person event (€40,000 budget). In charge of logistics and relationships with external vendors and 4 event sponsors.',
          'Junior Enterprise, Project Manager: completed client missions generating €45,000 in revenue.',
          'Networking Society, Root Administrator: managed IT infrastructure, servers, and websites, including the social platform for over 3,000 students.',
        ],
      },
    ],
  },
  {
    id: 'research',
    label: 'Research projects',
    expand: true,
    entries: [
      {
        title: 'Posterior sampling for Bayesian inverse problems',
        meta: 'Department of Applied Mathematics, supervised by Prof. Alain Durmus',
        date: 'Aug 2026 – Present',
        points: [
          'Posterior sampling with flow-matching and diffusion models for Bayesian inverse problems and PDE solving.',
          'How to improve existing samplers (e.g. MPGS) using physics-informed models, and working on convergence proofs.',
        ],
      },
      {
        title: 'Early action prediction in video',
        meta: 'Department of Computer Science, supervised by Dr Vicky Kalogeiton',
        date: 'Mar 2026 – Jun 2026',
        points: [
          'Carried out research on early action prediction in video, developing computer vision models to forecast future actions from initial video frames.',
          'Implemented and benchmarked deep learning architectures, including ResNets, V-JEPA, and VideoMAE.',
          'Achieved a prediction accuracy of 70.9%.',
        ],
        href: gh('WhatHappensNext'),
        paper: 'https://github.com/titouanblo/WhatHappensNext/blob/main/full_report.pdf',
      },
      {
        title: 'Quantum algorithms with error correction',
        meta: 'Team Scientific Project, Department of Computer Science',
        date: 'Sep 2025 – Jun 2026',
        points: [
          'Ran quantum algorithm simulations in a fault-tolerant environment.',
          'Used quantum error-correction methods and applied them to a quantum triangle-finding algorithm on graphs.',
        ],
        href: gh('QuantumErrorCorrectionCodes'),
      },
      {
        title: 'Energy-efficient cooling of a sports facility',
        meta: 'Experimental Project, Lycée Clemenceau, Nantes',
        date: '2023 – 2024',
        points: [
          'Designed and built autonomous environmental sensors using Arduino microcontrollers for temperature and humidity tracking.',
          'Engineered and conducted a controlled water-cooling experiment to measure its efficiency.',
        ],
      },
    ],
  },
  {
    id: 'code',
    label: 'Coding projects',
    compact: true,
    // One or two short sentences each: what it is, and at most one thing that stands out.
    entries: [
      { title: 'Twixer', date: 'Flutter · Python · 2024', text: 'Rebuilt Twitter from scratch: a Flutter mobile app backed by a Python REST API.', href: gh('Twixer') },
      {
        title: 'YouTube Educational Channel & Community',
        date: '2020 – 2022',
        text: 'Created technical tutorials in Python and Dart, accumulating over 430,000 total views. Built and managed a Discord community of 800+ members for technical Q&A.',
      },
      { title: 'bpcs', date: 'Python · 2023', text: 'Hides data inside images with the BPCS algorithm. The hidden data can be about half the size of the image itself.', href: gh('bpcs') },
      { title: 'MinMax', date: 'Python · 2023', text: 'Reusable minimax AI for two-player board games, running on several CPU cores. Tic-tac-toe and Connect Four are included as examples.', href: gh('MinMax') },
      { title: 'Enderbot', date: 'Python · MySQL · 2020', text: 'Multiplayer RPG Discord bot with mining, crafting, boss fights and trading between players.', href: gh('Enderbot') },
      { title: 'Bestagram', date: 'Swift · Python · MySQL · 2020', text: 'Instagram clone: a SwiftUI iOS app with its own Python and MySQL backend.', href: gh('Bestagram') },
      { title: 'Vocab', date: 'Swift · Flutter · 2021', text: 'A free app I built to help my classmates learn the vocabulary of their foreign languages. It asks the words you get wrong more often than the ones you know.', href: gh('Vocab-Flutter') },
      { title: 'Hidden, LSB Encoding', date: 'Flutter · 2023', text: 'Mobile app that hides one image inside another using least significant bit encoding.', href: gh('Hidden') },
      { title: 'RiskCalculator', date: 'Python · 2024', text: 'Computes the exact probability of winning a battle in the board game Risk: Star Wars.', href: gh('RiskCalculator') },
      { title: 'Newton’s Fractal', date: 'Python · 2022', text: 'Fractal generator using Newton’s root finding method.', href: gh('Newton-s-Fractal') },
    ],
    note: 'Programming: Python, Java, TypeScript, Swift, Dart, C++.',
  },
  {
    id: 'academics',
    label: 'Academics',
    expand: true,
    entries: [
      {
        title: 'École Polytechnique (X24), Palaiseau (France)',
        date: '2024 – Present',
        lead: 'One of France’s top-ranking universities for science and engineering.',
        points: [
          'Third-year student specializing in a Master’s level program in Applied Math and Artificial Intelligence with a minor in Computer Science (Cycle ingénieur).',
          'Relevant coursework includes Statistical Learning, Advanced Probability: Martingales and Applications, Deep Learning in Computer Vision, Optimization for AI, Reinforcement Learning and Autonomous Agents.',
          'GPA: 4.0/4.0',
        ],
      },
      {
        title: 'Lycée Clemenceau, Preparatory Program, Nantes (France)',
        date: '2022 – 2024',
        points: [
          'A post-secondary two-year program in advanced math and physics leading to nationwide entrance examinations to the Grandes Écoles for scientific studies.',
          'Undergraduate coursework includes Algebra, Analysis, Topology, Probability Theory, Thermodynamics, Electrodynamics, Waves and Signals, Electric Circuits.',
          'GPA: 4.0/4.0',
        ],
      },
      {
        title: 'Lycée Brizeux, Quimper (France)',
        date: 'Jun 2022',
        points: [
          'Baccalauréat in sciences (A-levels) awarded with highest honors.',
          'Academic exchange year in Ireland (County of Mayo).',
        ],
      },
    ],
    note: 'Languages: French (native), English (5.5/6 on TOEFL), Spanish (basic).',
  },
];
