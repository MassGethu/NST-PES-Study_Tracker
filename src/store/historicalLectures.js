/**
 * Lecture history transcribed from the user's NST past-lectures screenshots.
 * Only subject, topic, date, and the visible lecture/lab distinction are imported.
 */

const HISTORY_MIGRATION_KEY = '_lectureHistoryThrough20260918';

const SUBJECTS = {
  psp: { name: 'PSP', aliases: ['psp', 'programming for problem solving'] },
  maths: { name: 'M1', aliases: ['m1', 'maths 1', 'math 1', 'maths', 'math'] },
  english: { name: 'English', aliases: ['english', 'communication'] },
  physics: { name: 'Physics', aliases: ['physics', 'phy', 'ap-robo', 'ap robo'] },
  systems: { name: 'S&AI', aliases: ['s&ai', 'snai', 'snw', 'systems and ai', 'systems & ai'] },
  yoga: { name: 'Yoga', aliases: ['yoga'] },
};

const LECTURES = [
  ['maths', 'Lab_0', '2026-08-27', 'lab'],
  ['psp', 'Course and Instructor Introduction', '2026-08-27', 'lab'],
  ['psp', 'Course and Instructor Introduction, Intro to Programming, Computational Thinking', '2026-08-27', 'lecture'],
  ['english', 'Lecture 1 - English B', '2026-08-28', 'lecture'],
  ['psp', 'Flow Chart', '2026-08-31', 'lecture'],
  ['maths', 'Algebraic Equation, Constant and variable, Algebraic Expression', '2026-08-31', 'lecture'],
  ['psp', 'Lab', '2026-08-31', 'lab'],
  ['physics', 'Lecture 1', '2026-08-31', 'lecture'],

  ['systems', 'Introduction of Computer', '2026-09-01', 'lecture'],
  ['physics', 'Course and Instructor Introduction', '2026-09-01', 'lab'],
  ['maths', 'Quadratic Equation, Methods to Solve Linear Equation in 2 Variables', '2026-09-02', 'lecture'],
  ['physics', 'Scalars and Vectors, Vector Arithmetic, Vector Products, Vector Resolution', '2026-09-02', 'lecture'],
  ['psp', 'Intro to Programming, Computational Thinking, Flow Chart, Print function in python', '2026-09-02', 'lab'],
  ['maths', 'Algebraic Equation, Constant and variable, Algebraic Expression', '2026-09-02', 'lab'],
  ['psp', 'Print function in python, Comments in python, Python Variable', '2026-09-02', 'lecture'],
  ['systems', 'Computer Hardware, Computer Software, Operating System', '2026-09-03', 'lecture'],
  ['yoga', 'Lecture 2 - YOGA B1', '2026-09-03', 'lecture'],
  ['systems', 'Course and Instructor Introduction', '2026-09-03', 'lab'],
  ['physics', 'Mathematics of the Physical World, Sizes in the Universe, Introduction to Measurement', '2026-09-03', 'lab'],
  ['maths', 'Methods for Solving Quadratic Equation, Factorization and Completing the Square', '2026-09-04', 'lecture'],
  ['english', 'Lecture 2 - English B', '2026-09-04', 'lecture'],

  ['maths', 'Quadratic Formula', '2026-09-07', 'lecture'],
  ['psp', 'Python Input, Python operators, Input() function, Input() for different datatypes', '2026-09-07', 'lecture'],
  ['physics', 'Exploring Kinematics, Distance and Displacement, Speed and Velocity, Acceleration', '2026-09-07', 'lecture'],
  ['psp', 'PSP', '2026-09-07', 'lab'],
  ['maths', 'Lab', '2026-09-07', 'lab'],
  ['systems', 'Command-Line Interface (CLI), Terminal', '2026-09-08', 'lecture'],
  ['systems', 'Computer Systems, Computer Hardware, Computer Software, Operating System', '2026-09-08', 'lab'],
  ['psp', 'Conditional Statements, Python if- else', '2026-09-09', 'lecture'],
  ['maths', 'Linear Inequality, Linear Inequality in One and Two Variables, Inequalities', '2026-09-09', 'lecture'],
  ['physics', 'Relative Motion, Solving 1-D Motion, Projectile Motion', '2026-09-09', 'lecture'],
  ['psp', 'PSP Lab', '2026-09-09', 'lab'],
  ['maths', 'Lab', '2026-09-09', 'lab'],
  ['systems', 'Terminal, Command-Line Interface (CLI), CLI File & Directory Management', '2026-09-10', 'lab'],
  ['physics', 'Mathematics of the Physical World, Sizes in the Universe, Introduction to Measurement', '2026-09-10', 'lab'],
  ['systems', 'CLI File & Directory Management, CLI Package Management, CLI Flags, Options', '2026-09-10', 'lecture'],
  ['yoga', 'Lecture 3 - YOGA B1', '2026-09-10', 'lecture'],
  ['maths', 'Quadratic Inequality', '2026-09-11', 'lecture'],
  ['english', 'Lecture 3 - English B', '2026-09-11', 'lecture'],

  ['systems', 'Device Management, Operating System, CLI Package Management, CLI Flags, Options', '2026-09-15', 'lab'],
  ['physics', 'Scalars and Vectors', '2026-09-15', 'lab'],
  ['yoga', 'Lecture 4 - YOGA B1', '2026-09-15', 'lecture'],
  ['systems', 'Operating System, Operating System Architecture, Device Management, Process Management', '2026-09-15', 'lecture'],
  ['psp', 'If- elif-else ladder', '2026-09-16', 'lecture'],
  ['maths', 'Problem Solving Session, Invariance Principle, Parity Principle, Extremal Principle', '2026-09-16', 'lecture'],
  ['physics', "NLMs & FBDs, Forces & Types, Newton's Laws of Motion, Frames of Reference", '2026-09-16', 'lecture'],
  ['psp', 'Python Input, Python operators, Input() function, Input() for different datatypes', '2026-09-16', 'lab'],
  ['maths', 'Inequalities, Equality vs Inequality, Uses and Applications of Inequality', '2026-09-16', 'lab'],
  ['systems', 'Operating System, Operating System Architecture, Device Management, Process Management', '2026-09-17', 'lab'],
  ['physics', 'Vector Arithmetic', '2026-09-17', 'lab'],
  ['english', 'Lecture 4 - English B', '2026-09-18', 'lecture'],
];

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findSubject(subjects, subjectKey) {
  const aliases = SUBJECTS[subjectKey].aliases.map(normalize);
  return subjects.find(subject => aliases.includes(normalize(subject.name)));
}

export function addHistoricalLectures(rawState) {
  if (!rawState || rawState[HISTORY_MIGRATION_KEY]) return rawState;

  const subjects = [...(rawState.subjects || [])];
  const topics = [...(rawState.topics || [])];
  const subjectIds = {};

  Object.keys(SUBJECTS).forEach((key, index) => {
    let subject = findSubject(subjects, key);
    if (!subject) {
      subject = {
        id: `history-subject-${key}`,
        name: SUBJECTS[key].name,
        color: ['#10b981', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4'][index],
      };
      subjects.push(subject);
    }
    subjectIds[key] = subject.id;
  });

  const existing = new Set(topics.map(topic => `${topic.subjectId}|${topic.date}|${normalize(topic.topicName)}`));
  const additions = [];

  LECTURES.forEach(([subjectKey, topicName, date, sessionType], index) => {
    const subjectId = subjectIds[subjectKey];
    const dedupeKey = `${subjectId}|${date}|${normalize(topicName)}`;
    if (existing.has(dedupeKey)) return;
    existing.add(dedupeKey);
    additions.push({
      id: `history-lecture-${date}-${String(index + 1).padStart(2, '0')}`,
      subjectId,
      topicName,
      date,
      sessionType,
      concepts: [],
      bullets: [],
      difficulty: 3,
      understoodPct: 70,
      confidence: 3,
      needsRevision: true,
      contestRelevance: 'Medium',
      notes: '',
      lastRevised: null,
      revisionStage: 0,
      _nextRevision: null,
    });
  });

  return {
    ...rawState,
    subjects,
    topics: [...additions, ...topics],
    [HISTORY_MIGRATION_KEY]: true,
  };
}

