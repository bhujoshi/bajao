/** Inclusive calendar dates: an event remains ongoing through its To date. */
export function groupHostedEvents<T extends { date: string; endDate?: string | null }>(events: T[], now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const ongoing: T[] = [], upcoming: T[] = [], past: T[] = [];
  for (const event of events) {
    const start = event.date.slice(0,10), end = (event.endDate || event.date).slice(0,10);
    if (end < today) past.push(event);
    else if (start > today) upcoming.push(event);
    else ongoing.push(event);
  }
  ongoing.sort((a,b)=>a.date.localeCompare(b.date));
  upcoming.sort((a,b)=>a.date.localeCompare(b.date));
  past.sort((a,b)=>(b.endDate || b.date).localeCompare(a.endDate || a.date));
  return [
    {id:"ongoing", title:"Ongoing events", description:"The events you are hosting today.", events:ongoing},
    {id:"upcoming", title:"Upcoming events", description:"Get everything ready for your next celebration or gathering.", events:upcoming},
    {id:"past", title:"Previously hosted events", description:"Revisit your past events, guest lists and invitations.", events:past},
  ];
}
