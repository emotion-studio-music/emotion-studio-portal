import { useAllDemos } from './demos';
import { useOpenArtistNotes } from './comments';
import { todayKey, usePayments, useTasks } from './business';

/** Tutto quello che chiede l'attenzione dello studio, per la vista "Oggi" e il contatore nel menu. */
export function useToday() {
  const demos = useAllDemos(true).filter((d) => d.status === 'nuova');
  const notes = useOpenArtistNotes(true);
  const payments = usePayments('tutti');
  const tasks = useTasks('tutti');
  const today = todayKey();
  const reported = payments.filter((p) => p.status === 'segnalato');
  const overduePayments = payments.filter((p) => p.status === 'da_pagare' && p.dueDate && p.dueDate < today);
  const dueTasks = tasks.filter((t) => !t.done && ((t.dueDate && t.dueDate <= today) || (t.assignee === 'admin' && !t.dueDate)));
  const count = demos.length + notes.length + reported.length + overduePayments.length + dueTasks.length;
  return { demos, notes, reported, overduePayments, dueTasks, count };
}
