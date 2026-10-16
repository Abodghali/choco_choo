'use client';
import { useCustomerLanguage } from './CustomerLanguage';
import type { MenuItem } from '@/lib/db';
import { formatPrice } from '@/lib/utils';
export default function CartOptions({ extras, selected, note, onChange }: {
 extras: MenuItem[]; selected: string[]; note: string;
 onChange: (value: { addOnIds: string[]; note: string }) => void;
}) {
 const { t, itemName } = useCustomerLanguage();
 return <div className="cart-customization">
  {extras.length > 0 && <details><summary>{t("Add Ons · Přidat něco navíc")}</summary>
   <p className="option-help">{t("Cena za jeden kus jídla.")}</p>
   <div className="addon-options">{extras.map(extra => <label key={extra.id}>
    <input type="checkbox" checked={selected.includes(extra.id)} onChange={e => onChange({note,addOnIds:e.target.checked?[...selected,extra.id]:selected.filter(id=>id!==extra.id)})}/>
    <span>{itemName(extra)}</span><strong>+{formatPrice(extra.price)}</strong>
   </label>)}</div>
  </details>}
  <label className="note-label">{t("Poznámka pro obsluhu")}
   <textarea maxLength={500} rows={2} value={note} placeholder={t("Např. bez ořechů…")} onChange={e => onChange({addOnIds:selected,note:e.target.value})}/>
  </label>
 </div>;
}
