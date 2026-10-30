// context.js — the events that precede each tape (2026-10-22). Claude draft; every z is a proposal for Sailor's ruling.
//
// Vantage (Sailor, 10-22): the plane is read from the audience's position — American citizens and voters,
// the people the government says it acts for. So each event carries two readings:
//   ownZ — did it deliver its holder's object, as designed?     (+1 realized … −1 frustrated)
//   z    — did it deliver for the audience, as of the tape's date? (+1 realized … −1 frustrated)
// The Rim Rule signs z by the station's trust in the instrument's holder; the audience's default trust is in
// its own government. Where a holder delivers its object but not *to* the audience, the two readings split —
// Iran-Contra is the case, and it carries a diagnostic boundary (bench #14: "delivers the object" vs "delivers to me").
//
// links: tape line numbers whose landing re-pulses the event (the displacement reaching the conversation).
// vacancy: tape line numbers where the event sits in the record but not in the talk (π-mode: vacancy).
window.CONTEXT = {
  '1992': [
    { id: 'IC', name: 'Iran-Contra', when: '1985–87', sort: 1986.8, holder: 'the Reagan administration (NSC staff)',
      ownZ: .7, z: .35,
      note: 'Arms sold to Iran; proceeds routed to the Contras despite the Boland Amendment. Exposed November 1986.',
      vacancy: [24, 84],
      boundary: {
        good: { label: 'The good-faith reading', z: .5, items: [
          ['Irregular means, a legitimate end: contain the Sandinistas, free the hostages', '1986–87', 'held in the room, 1992'],
          ['Nicaragua moves toward democracy', 'Feb 1990', 'Chamorro defeats the Sandinistas at the ballot'],
          ['No lasting cost to the rule of law', 'Dec 1992', 'Bush pardons Weinberger and five others — no final accounting'],
        ] },
        hollow: { label: 'The reciprocal contradictions', z: -.6, items: [
          ['Bypassing Congress weakens accountability', '1987–92', 'convictions vacated or pardoned'],
          ['Contra supply lines touch the drug trade', 'Apr 1989', 'Senate (Kerry) subcommittee report finds links'],
          ['Arming the region deepens its wars and the arms trade', '1980s–90s', 'contested — peace accords 1992 (El Salvador), 1996 (Guatemala)'],
          ['Destabilization drives migration north', '1990s–2020s', 'Sailor\'s hypothesis — migration rose; the causal share is argued'],
        ] },
      } },
    { id: 'TIAN', name: 'Tiananmen Square', when: 'June 1989', sort: 1989.43, holder: 'the Chinese government', ownZ: .8, z: -.5,
      note: 'The protests are crushed; the party-state survives. The authoritarian case the thesis has to absorb.', links: [46] },
    { id: 'WALL', name: 'The Berlin Wall opens', when: 'Nov 1989', sort: 1989.86, holder: 'the East German government', ownZ: -.9, z: .9,
      note: 'The wall stops working as a wall. The visible end of the Cold War.', links: [3] },
    { id: 'GULF', name: 'The Gulf War', when: 'Jan–Feb 1991', sort: 1991.1, holder: 'the US-led coalition', ownZ: .8, z: .7,
      note: 'Kuwait restored in six weeks; Saddam Hussein stays in power.' },
    { id: 'YUGO', name: 'Yugoslavia breaks apart', when: 'June 1991', sort: 1991.48, holder: 'the republics\' nationalist leaderships', ownZ: .3, z: -.6,
      note: 'Slovenia and Croatia declare independence; war follows. The "intolerant nationalism" he names.', links: [40] },
    { id: 'COUP', name: 'The August coup fails', when: 'Aug 1991', sort: 1991.63, holder: 'Soviet hardliners', ownZ: -.9, z: .7,
      note: 'Three days; crowds in the streets of Moscow and Leningrad. He cites it on tape.', links: [48, 54] },
    { id: 'USSR', name: 'The Soviet Union dissolves', when: 'Dec 1991', sort: 1991.98, holder: 'the Soviet state', ownZ: -1, z: .95,
      note: 'Seven weeks before this taping. The rival is gone.', links: [5, 47, 88] },
  ],
  '2011': [
    // carried forward: already settled on the plane when the 2011 opening begins
    { id: 'IC', carry: true, name: 'Iran-Contra', when: '1985–87', sort: 1986.8, holder: 'the Reagan administration (NSC staff)', ownZ: .7, z: .35,
      note: 'Carried from 1992. Rule of law bypassed, then forgiven.', vacancy: [16, 18], boundaryFrom: '1992' },
    { id: 'USSR', carry: true, name: 'The Soviet Union dissolves', when: 'Dec 1991', sort: 1991.98, holder: 'the Soviet state', ownZ: -1, z: .95,
      note: 'Carried from 1992.', links: [7, 10] },
    { id: 'NINE', name: 'September 11', when: 'Sept 2001', sort: 2001.7, holder: 'al-Qaeda', ownZ: .8, z: -.9,
      note: 'The objection critics raise against the thesis, by name.', links: [10] },
    { id: 'IRAQ', name: 'The invasion of Iraq', when: 'Mar 2003', sort: 2003.22, holder: 'the US government', ownZ: .3, z: -.4,
      note: 'The regime falls; the weapons it was sold on are not found; the war runs on. Fukuyama broke with its architects over it.' },
    { id: 'ORANGE', name: 'The Orange Revolution', when: '2004–05', sort: 2004.9, holder: 'Ukraine\'s protest movement', ownZ: -.3, z: -.3,
      note: 'A stolen election overturned in the streets — and the man who stole it elected in February 2010.', links: [12, 14] },
    { id: 'CRASH', name: 'The financial crash', when: 'Sept 2008', sort: 2008.71, holder: 'the US financial system', ownZ: -.8, z: -.8,
      note: 'Lehman fails; the debt he talks about on tape.', links: [46] },
    { id: 'ARAB', name: 'The Arab Spring begins', when: 'Dec 2010–Feb 2011', sort: 2011.0, holder: 'protest movements in Tunisia and Egypt', ownZ: .6, z: .4,
      note: 'Ben Ali falls in January, Mubarak in February — weeks before this taping.', links: [4, 40, 42, 44] },
  ],
};
