// Centralized tour matching logic
import type { TourReference } from '../types.ts';

export function matchTour(
  userMessage: string,
  availableTours: any[],
  expectedInput: string
): TourReference | null {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  // 1. Try to match by tour number (only if not expecting pax)
  if (!['pax_count', 'phone_number', 'full_name'].includes(expectedInput)) {
    const tourNumber = parseInt(lowerMessage);
    if (!isNaN(tourNumber) && tourNumber >= 1 && tourNumber <= availableTours.length) {
      const tour = availableTours[tourNumber - 1];
      return createTourReference(tour);
    }
  }
  
  // 2. Try exact title match
  let matchedTour = availableTours.find(tour =>
    tour.title.toLowerCase() === lowerMessage
  );
  
  if (matchedTour) {
    return createTourReference(matchedTour);
  }
  
  // 3. Try destination match
  matchedTour = availableTours.find(tour =>
    tour.destination.toLowerCase() === lowerMessage
  );
  
  if (matchedTour) {
    return createTourReference(matchedTour);
  }
  
  // 4. Try keyword matching
  matchedTour = availableTours.find(tour => {
    const tourWords = [
      ...tour.title.toLowerCase().split(/\s+/),
      ...tour.destination.toLowerCase().split(/\s+/)
    ];
    
    // Check if any significant word (>3 chars) from tour matches message
    return tourWords.some(word => 
      word.length > 3 && lowerMessage.includes(word)
    );
  });
  
  if (matchedTour) {
    return createTourReference(matchedTour);
  }
  
  return null;
}

function createTourReference(tour: any): TourReference {
  return {
    id: tour.id,
    title: tour.title,
    destination: tour.destination,
    dateId: tour.dates?.[0]?.id,
    selectedDate: tour.dates?.[0]?.departure_date
  };
}

export function findTourById(tourId: string, availableTours: any[]): any | null {
  return availableTours.find(t => t.id === tourId) || null;
}

export function formatTourList(tours: any[], language: string = 'tr'): string {
  if (language === 'tr') {
    return tours.map((tour, idx) => 
      `${idx + 1}. ${tour.title} - ${tour.destination} (${tour.dates?.[0]?.price_adult}₺)`
    ).join('\n');
  }
  
  return tours.map((tour, idx) => 
    `${idx + 1}. ${tour.title} - ${tour.destination} (${tour.dates?.[0]?.price_adult}₺)`
  ).join('\n');
}
