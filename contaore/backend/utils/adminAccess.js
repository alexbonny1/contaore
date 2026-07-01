import { supabase } from '../services/supabase.js'

/*
  Ritorna null se l'utente non ha restrizioni di accesso ai dipendenti
  (owner, superadmin, o admin senza un sottoinsieme assegnato — accesso a tutti),
  altrimenti l'array di dipendente_id a cui l'admin ha accesso.
*/
export async function getAllowedDipendenteIds(user) {
  if (user.role !== 'admin') return null
  const { data } = await supabase
    .from('user_account')
    .select('assigned_dipendente_ids')
    .eq('id', user.id)
    .single()
  const ids = data?.assigned_dipendente_ids
  return Array.isArray(ids) && ids.length ? ids : null
}

export function isDipendenteAllowed(allowedIds, dipendenteId) {
  return !allowedIds || allowedIds.includes(dipendenteId)
}
