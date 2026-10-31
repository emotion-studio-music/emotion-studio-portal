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
  const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const byDate = (a: { dueDate: string }, b: { dueDate: string }) => (a.dueDate || '9').localeCompare(b.dueDate || '9');
  // I tuoi task: tutti quelli aperti, anche con scadenza lontana
  const myTasks = tasks.filter((t) => !t.done && t.assignee === 'admin').sort(byDate);
  // Task degli artisti: solo quelli scaduti o in scadenza entro 3 giorni
  const artistTasks = tasks.filter((t) => !t.done && t.assignee === 'artist' && t.dueDate && t.dueDate <= inDays(3)).sort(byDate);
  // Nel contatore: i tuoi task senza data o entro 3 giorni, più quelli scaduti degli artisti
  const urgentMine = myTasks.filter((t) => !t.dueDate || t.dueDate <= inDays(3)).length;
  const lateArtist = artistTasks.filter((t) => t.dueDate < today).length;
  const count = demos.length + notes.length + reported.length + overduePayments.length + urgentMine + lateArtist;
  return { demos, notes, reported, overduePayments, myTasks, artistTasks, count };
}
