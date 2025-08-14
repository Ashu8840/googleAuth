import { Subject } from '../types';

export const subjects: Subject[] = [
  {
    name: 'Data Structures',
    description: 'Fundamental concepts for organizing, managing and storing data.',
    topics: ['Arrays', 'Linked Lists', 'Stacks', 'Queues', 'Trees', 'Graphs', 'Hash Tables', 'Heaps'],
  },
  {
    name: 'Algorithms',
    description: 'A process or set of rules to be followed in calculations or other problem-solving operations.',
    topics: ['Sorting Algorithms', 'Search Algorithms', 'Recursion', 'Dynamic Programming', 'Greedy Algorithms', 'Divide and Conquer'],
  },
  {
    name: 'Operating Systems',
    description: 'System software that manages computer hardware, software resources.',
    topics: ['Processes vs Threads', 'Memory Management', 'CPU Scheduling', 'File Systems', 'Deadlocks', 'Concurrency'],
  },
  {
    name: 'Computer Networks',
    description: 'The study of how computers are connected to share resources.',
    topics: ['OSI Model', 'TCP/IP Protocol', 'HTTP vs HTTPS', 'DNS', 'Sockets', 'Routing Algorithms'],
  },
  {
    name: 'Database Systems',
    description: 'The study of databases and database management systems.',
    topics: ['SQL vs NoSQL', 'Database Normalization', 'ACID Properties', 'Indexing', 'Transactions', 'Joins'],
  },
  {
    name: 'System Design',
    description: 'The process of defining the architecture, components, modules, interfaces, and data for a system.',
    topics: ['Scalability', 'Load Balancing', 'Caching', 'Database Sharding', 'Microservices', 'API Design (REST vs GraphQL)'],
  },
];
