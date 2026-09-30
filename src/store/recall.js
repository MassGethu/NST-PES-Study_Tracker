export function referencesFor(topics) {
  return topics.map(topic => {
    const clean = value => typeof value === 'string' ? value.trim() : '';
    const aiNotes = clean(topic.ai_notes);
    const notes = [...(topic.bullets || []).map(clean), clean(topic.notes)].filter(value => value && !/^https?:\/\/\S+$/i.test(value)).join('\n');
    return { id: topic.id, topicName: topic.topicName, date: topic.date,
      sessionType: topic.sessionType || 'lecture', subjectId: topic.subjectId,
      concepts: topic.concepts || [], reference: aiNotes || notes };
  });
}
export function hasRecallReference(topic) { return Boolean(referencesFor([topic])[0].reference); }
export function recallStatus(session) {
  if (session.status === 'complete') return 'Assessed';
  if (!session.lectures.some(lecture => lecture.reference?.trim())) return 'Notes needed';
  return session.status === 'failed' ? 'Assessment failed' : 'Assessment pending';
}
