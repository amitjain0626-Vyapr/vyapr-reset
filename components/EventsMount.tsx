// @ts-nocheck
'use client';

import EventsSubscriber from './EventsSubscriber';

// Minimal client wrapper so a Server Component page can include our client subscriber
export default function EventsMount() {
  return <EventsSubscriber />;
}
