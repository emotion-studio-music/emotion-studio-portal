import { useEffect, useState } from 'react';
import {
  addDoc, collection, collectionGroup, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, type DocumentData, type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { safeUrl } from './safeUrl';

const ms = (t: unknown) => (t as Timestamp | undefined)?.toMillis?.() ?? Date.now();
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtDay = (key: string) => (key ? new Date(`${key}T12:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

// ── Tipi ──

export interface Quote {
  id: string; artistId: string; title: string; amountCents: number; projectId: string | null; note: string; createdMs: number;
  services: string[];       // servizi concordati
  trackIds: string[];       // brani coinvolti
  pricing: 'brano' | 'totale';
  unitCents: number;        // prezzo a brano (se pricing = 'brano')
}

export type PaymentStatus = 'da_pagare' | 'segnalato' | 'pagato';
export type PaymentKind = 'acconto' | 'saldo' | 'altro';
export interface Payment {
  id: string; artistId: string; quoteId: string; kind: PaymentKind; amountCents: number; status: PaymentStatus;
  dueDate: string; cardLink: string; invoiceNumber: string; note: string; reportedMethod: string;
  paidDate: string; createdMs: number;
}

export interface Task {
  id: string; artistId: string; title: string; assignee: 'artist' | 'admin'; dueDate: string; trackId: string | null;
  done: boolean; createdMs: number;
}

export const SESSION_TYPES = ['Registrazione', 'Mix', 'Mastering', 'Produzione', 'Consulenza'];
export interface Session {
  id: string; artistId: string; date: string; hours: number; type: string; description: string; trackIds: string[]; createdMs: number;
}

const toQuote = (id: string, a: string, d: DocumentData): Quote => ({
  id, artistId: a, title: d.title ?? '', amountCents: d.amountCents ?? 0, projectId: d.projectId ?? null, note: d.note ?? '', createdMs: ms(d.createdAt),
  services: d.services ?? [], trackIds: d.trackIds ?? [], pricing: d.pricing ?? 'totale', unitCents: d.unitCents ?? 0,
});
const toPayment = (id: string, a: string, d: DocumentData): Payment => ({
  id, artistId: a, quoteId: d.quoteId ?? '', kind: d.kind ?? 'altro', amountCents: d.amountCents ?? 0, status: d.status ?? 'da_pagare',
  dueDate: d.dueDate ?? '', cardLink: safeUrl(d.cardLink) ?? '', invoiceNumber: d.invoiceNumber ?? '', note: d.note ?? '',
  reportedMethod: d.reportedMethod ?? '', paidDate: d.paidDate ?? '', createdMs: ms(d.createdAt),
});
const toTask = (id: string, a: string, d: DocumentData): Task => ({
  id, artistId: a, title: d.title ?? '', assignee: d.assignee ?? 'artist', dueDate: d.dueDate ?? '', trackId: d.trackId ?? null,
  done: d.done ?? false, createdMs: ms(d.createdAt),
});
const toSession = (id: string, a: string, d: DocumentData): Session => ({
  id, artistId: a, date: d.date ?? '', hours: d.hours ?? 0, type: d.type ?? '', description: d.description ?? '',
  trackIds: d.trackIds ?? [], createdMs: ms(d.createdAt),
});

// ── Letture ──

function useSub<T>(name: string, artistId: string | null | 'tutti', map: (id: string, a: string, d: DocumentData) => T) {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    if (!artistId) return;
    const ref = artistId === 'tutti' ? collectionGroup(db, name) : collection(db, 'artists', artistId, name);
    return onSnapshot(ref, (s) => setItems(s.docs.map((d) => map(d.id, d.ref.parent.parent?.id ?? '', d.data()))), () => setItems([]));
  }, [name, artistId]); // eslint-disable-line react-hooks/exhaustive-deps
  return items;
}

/** artistId = id dell'artista, oppure 'tutti' (solo admin) */
export const useQuotes = (artistId: string | null | 'tutti') => useSub('quotes', artistId, toQuote);
export const usePayments = (artistId: string | null | 'tutti') => useSub('payments', artistId, toPayment);
export const useTasks = (artistId: string | null | 'tutti') => useSub('tasks', artistId, toTask);
export const useSessions = (artistId: string | null) => useSub('sessions', artistId, toSession);

export function quoteSummary(q: Quote, payments: Payment[]) {
  const mine = payments.filter((p) => p.quoteId === q.id);
  const paid = mine.filter((p) => p.status === 'pagato').reduce((s, p) => s + p.amountCents, 0);
  return { paid, left: Math.max(0, q.amountCents - paid), payments: mine.sort((a, b) => a.createdMs - b.createdMs) };
}

// ── Scritture ──

const col = (a: string, name: string) => collection(db, 'artists', a, name);
const ref = (a: string, name: string, id: string) => doc(db, 'artists', a, name, id);

export const createQuote = (a: string, q: Pick<Quote, 'title' | 'amountCents' | 'projectId' | 'note'> & Partial<Pick<Quote, 'services' | 'trackIds' | 'pricing' | 'unitCents'>>) =>
  addDoc(col(a, 'quotes'), { ...q, createdAt: serverTimestamp() });
export const updateQuote = (a: string, id: string, q: Partial<Pick<Quote, 'title' | 'amountCents' | 'note'>>) => updateDoc(ref(a, 'quotes', id), q);
export const deleteQuote = (a: string, id: string) => deleteDoc(ref(a, 'quotes', id));

export const createPayment = (a: string, p: Pick<Payment, 'quoteId' | 'kind' | 'amountCents' | 'status' | 'dueDate' | 'cardLink' | 'note'> & { paidDate?: string }) =>
  addDoc(col(a, 'payments'), { invoiceNumber: '', reportedMethod: '', paidDate: '', ...p, createdAt: serverTimestamp() });
export const updatePayment = (a: string, id: string, p: Partial<Omit<Payment, 'id' | 'artistId' | 'createdMs'>>) => updateDoc(ref(a, 'payments', id), p);
export const deletePayment = (a: string, id: string) => deleteDoc(ref(a, 'payments', id));
/** L'artista segnala di aver pagato: lo studio poi conferma. */
export const reportPaid = (a: string, id: string, method: string) =>
  updateDoc(ref(a, 'payments', id), { status: 'segnalato', reportedMethod: method, reportedAt: serverTimestamp() });

export const createTask = (a: string, t: Pick<Task, 'title' | 'assignee' | 'dueDate' | 'trackId'>) =>
  addDoc(col(a, 'tasks'), { ...t, done: false, createdAt: serverTimestamp() });
export const setTaskDone = (a: string, id: string, done: boolean) => updateDoc(ref(a, 'tasks', id), { done, doneAt: done ? serverTimestamp() : null });
export const deleteTask = (a: string, id: string) => deleteDoc(ref(a, 'tasks', id));
export const setTaskAssignee = (a: string, id: string, assignee: 'artist' | 'admin') => updateDoc(ref(a, 'tasks', id), { assignee });

export const createSession = (a: string, s: Pick<Session, 'date' | 'hours' | 'type' | 'description' | 'trackIds'>) =>
  addDoc(col(a, 'sessions'), { ...s, createdAt: serverTimestamp() });
export const deleteSession = (a: string, id: string) => deleteDoc(ref(a, 'sessions', id));

/** "Registrazione + Mix + Master" → titolo compatto "Rec + Mix + Master" */
export function servicesTitle(services: string[]): string {
  const short: Record<string, string> = { Registrazione: 'Rec' };
  return services.map((x) => short[x] ?? x).join(' + ');
}

export const PAYMENT_KIND: Record<PaymentKind, string> = { acconto: 'Acconto', saldo: 'Saldo', altro: 'Pagamento' };
export const PAY_METHODS = ['Bonifico', 'PayPal', 'Satispay', 'Carta', 'Contanti'];
