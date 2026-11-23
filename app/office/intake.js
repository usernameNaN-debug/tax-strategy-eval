// What a reader sees on the first sheet of each folder. Plain facts about who
// the people are. Nothing here hints at where the money is; that's the
// agent's job, and the reader's if they explore.

export const INTAKE = {
  morenos_oh: {
    surname: 'Moreno', given: 'Ana & Luis', place: 'Columbus, Ohio',
    prose: 'Ana and Luis live in Columbus. Ana is an ICU nurse paid by the hour; Luis is a salaried logistics analyst. Sofia is four. Mateo was born in March 2025, so this is the first return with him on it.',
  },
  haines_fl: {
    surname: 'Haines', given: 'Dolores', place: 'Florida',
    prose: 'Dolores is 74 and lives on her own in Florida. She retired from a school library. Her husband Walter died in September 2022. Social Security, a survivor pension and an IRA cover the bills.',
  },
  raghavan_becker_ca: {
    surname: 'Raghavan', given: 'Priya & Tom Becker', place: 'California',
    prose: 'Priya and Tom are in their late thirties and both work in tech in California. Priya is a staff engineer at a public company and is paid partly in stock. Tom is a product manager at a health-tech company. No kids.',
  },
  haddad_co: {
    surname: 'Haddad', given: 'Noor', place: 'Colorado',
    prose: 'Noor is 31 and works for herself in Colorado as a brand designer. No employees, six clients last year, health insurance bought on the state exchange.',
  },
  vega_nv: {
    surname: 'Vega', given: 'Marisol', place: 'Nevada',
    prose: 'Marisol is 29 and cuts hair at a salon in Nevada, on the salon’s payroll. Her son Diego is nine and lives with her.',
  },
};

export const FILING = { mfj: 'Married filing jointly', single: 'Single', hoh: 'Head of household' };

// Color-coded end-tab letters, the way medical records are filed.
const TAB = ['#c4453c', '#2f5ea8', '#2d7d4e', '#d99a2b', '#7a4b9c', '#d4652a', '#2b8a8f', '#b4436c', '#5d7330', '#8a5a33', '#3c86c2', '#9a2e2e', '#454545'];
export const tabColor = (ch) => TAB[(ch.toUpperCase().charCodeAt(0) - 65 + 26) % 13];

// Where each kind of source sits in the office.
export const PLACE = {
  folder: 'desk', flyers: 'desk', inbox: 'desk', cabinet: 'desk',
  portal: 'portals', library: 'library', law: 'law', screen: 'news', vault: 'archive', phone: 'client',
};
export const PLACES = [
  { id: 'desk', name: 'The desk', what: 'The folder the client handed over, the inbox, the filing cabinet, and whatever mail is lying around.' },
  { id: 'portals', name: 'Portals', what: 'Employer, bank, insurer and brokerage logins. Pay stubs, plan summaries, year-end statements.' },
  { id: 'library', name: 'Library', what: 'IRS publications, notices and form instructions, current to March 2026.' },
  { id: 'law', name: 'Law', what: 'Regulations and case law, for the questions the publications don’t settle.' },
  { id: 'news', name: 'News', what: 'A year of broadcasts: the market, rate cuts, and the tax bill signed in July.' },
  { id: 'archive', name: 'Archive', what: 'Old returns and records in boxes, going back years.' },
  { id: 'client', name: 'Client', what: 'A phone. Some facts only exist in the client’s head, and they only come out if you ask.' },
];
export const HOPS = ['On the desk', 'One hop away', 'Further in', 'Only if you ask'];
