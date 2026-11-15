"use client";
import { useId, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, CountryCode } from "libphonenumber-js/max";
import { validPhone } from "@/lib/contact-validation";
const names = new Intl.DisplayNames(["en"], {type:"region"});
const countries = getCountries().sort((a,b)=>(names.of(a)||a).localeCompare(names.of(b)||b));
export default function CountryPhoneInput({value,onChange,required=false,label="Phone number",disabled=false}: {value:string;onChange:(value:string)=>void;required?:boolean;label?:string;disabled?:boolean}) {
  const id = useId();
  const [country,setCountry] = useState<CountryCode>(()=>parsePhoneNumberFromString(value)?.country || "IN");
  const [touched,setTouched] = useState(false);
  const calling = getCountryCallingCode(country);
  const national = value.startsWith(`+${calling}`) ? value.slice(calling.length+1) : (parsePhoneNumberFromString(value)?.nationalNumber || value.replace(/^\+/,""));
  const error = touched && ((required && !value) || (value && !validPhone(value)));
  return <div className="space-y-1"><label htmlFor={id} className="block text-xs font-semibold text-stone-700">{label}{required ? " *" : ""}</label>
    <div className="flex gap-2">
      <select aria-label={`${label} country code`} value={country} disabled={disabled} onChange={e=>{const next=e.target.value as CountryCode;setCountry(next);onChange(national?`+${getCountryCallingCode(next)}${national}`:"");}} className="w-40 min-w-0 rounded-xl border border-stone-300 bg-white px-2 py-2.5 text-sm">
        {countries.map(c=><option key={c} value={c}>{names.of(c)} (+{getCountryCallingCode(c)})</option>)}
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" required={required} disabled={disabled} value={national} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} placeholder="Phone number" onBlur={()=>setTouched(true)} onChange={e=>{const raw=e.target.value; if(raw.startsWith("+")){const parsed=parsePhoneNumberFromString(raw);if(parsed?.country)setCountry(parsed.country);onChange(raw);}else{const digits=raw.replace(/[\s().-]/g,"");onChange(digits?`+${calling}${digits}`:"");}}} className="w-full min-w-0 rounded-xl border border-stone-300 px-3 py-2.5 text-sm"/>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-700">Enter a valid phone number for {names.of(country)}.</p>}
  </div>;
}
