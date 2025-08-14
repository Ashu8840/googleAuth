import React, { useState } from 'react';

interface CalendarEvent {
  id: number;
  date: string; // YYYY-MM-DD
  title: string;
  time: string;
}

const SchedulerPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEventTime, setNewEventTime] = useState('10:00');

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(startOfMonth);
  startDate.setDate(startDate.getDate() - startOfMonth.getDay());
  const endDate = new Date(endOfMonth);
  endDate.setDate(endDate.getDate() + (6 - endOfMonth.getDay()));

  const days = [];
  let day = new Date(startDate);
  while (day <= endDate) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddEvent = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newEventTitle || !newEventDate || !newEventTime) return;
      const newEvent: CalendarEvent = {
          id: Date.now(),
          date: newEventDate,
          title: newEventTitle,
          time: newEventTime,
      };
      setEvents([...events, newEvent].sort((a,b) => new Date(a.date+'T'+a.time).getTime() - new Date(b.date+'T'+b.time).getTime()));
      setNewEventTitle('');
  };
  
  const handleDeleteEvent = (id: number) => {
      setEvents(events.filter(event => event.id !== id));
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 bg-gray-800 rounded-lg p-4 md:p-6 animate-fade-in">
        {/* Calendar View */}
        <div className="flex-grow lg:w-2/3">
            <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-xl font-bold text-white">
                    {currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
                </h2>
                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => {
                    const isToday = new Date().toDateString() === d.toDateString();
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();
                    const dayEvents = events.filter(e => e.date === d.toISOString().split('T')[0]);
                    return (
                        <div key={i} className={`p-1 md:p-2 h-20 md:h-24 rounded-lg flex flex-col ${isCurrentMonth ? 'bg-gray-900' : 'bg-gray-900/50 text-gray-500'} transition-colors`}>
                            <span className={`font-bold text-xs md:text-sm ${isToday ? 'text-blue-400' : ''}`}>{d.getDate()}</span>
                            <div className="mt-1 overflow-y-auto text-xs space-y-1">
                                {dayEvents.map(e => <div key={e.id} className="p-1 bg-blue-600/50 rounded truncate text-white text-[10px] md:text-xs">{e.title}</div>)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Event Management */}
        <div className="lg:w-1/3 flex flex-col gap-6">
            <div className="bg-gray-900 p-4 rounded-lg">
                <h3 className="font-bold text-lg text-white mb-3">Add New Event</h3>
                <form onSubmit={handleAddEvent} className="space-y-4">
                    <input type="text" placeholder="Event Title" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} required className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} required className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                        <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} required className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-500 transition-colors">Add Event</button>
                </form>
            </div>
            <div className="bg-gray-900 p-4 rounded-lg flex-grow flex flex-col">
                <h3 className="font-bold text-lg text-white mb-3">Upcoming Events</h3>
                <div className="space-y-3 overflow-y-auto flex-grow">
                    {events.filter(e => new Date(e.date + 'T' + e.time) >= new Date(new Date().toDateString())).length > 0 ? (
                        events.filter(e => new Date(e.date + 'T' + e.time) >= new Date(new Date().toDateString())).map(event => (
                            <div key={event.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md animate-fade-in">
                                <div>
                                    <p className="font-semibold text-white">{event.title}</p>
                                    <p className="text-sm text-gray-400">{new Date(event.date+'T'+event.time).toLocaleString()}</p>
                                </div>
                                <button onClick={() => handleDeleteEvent(event.id)} className="text-red-400 hover:text-red-300 transition-colors text-2xl font-bold">&times;</button>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            <p>No upcoming events.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default SchedulerPage;