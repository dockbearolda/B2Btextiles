'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Ctx = { isAdmin: boolean; editing: boolean; setEditing: (v: boolean) => void };
const EditCtx = createContext<Ctx>({ isAdmin: false, editing: false, setEditing: () => {} });

export function EditModeProvider({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(isAdmin);
  // The root layout persists across the soft navigation that follows login, so
  // `editing` would otherwise keep the value it had while logged out. Resync it
  // whenever auth status flips: ON by default once connected, OFF on logout.
  useEffect(() => { setEditing(isAdmin); }, [isAdmin]);
  useEffect(() => {
    document.body.setAttribute('data-edit-mode', isAdmin && editing ? 'on' : 'off');
  }, [isAdmin, editing]);
  return <EditCtx.Provider value={{ isAdmin, editing, setEditing }}>{children}</EditCtx.Provider>;
}
export const useEditMode = () => useContext(EditCtx);
