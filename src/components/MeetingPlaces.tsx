import type { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';
import { useEffect, useState } from 'react';

type MeetingPlaceType = Schema['MeetingPlace']['type'];

export function MeetingPlaces() {
  const placesClient = generateClient<Schema>().models.MeetingPlace;
  const [meetingPlaces, setMeetingPlaces] = useState<Array<MeetingPlaceType>>(
    [],
  );

  useEffect(() => {
    const sub = placesClient.observeQuery().subscribe({
      next: data => setMeetingPlaces([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  function createPlace() {
    placesClient.create({
      location: window.prompt('Place location')!,
    });
  }

  return (
    <main>
      <button onClick={createPlace}>Create place</button>
      <h3>All places:</h3>
      <ul>
        {meetingPlaces.map(place => (
          <li key={place.id}>{place.location}</li>
        ))}
      </ul>
    </main>
  );
}
