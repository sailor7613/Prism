// ============================================================
// DATA.JS — Event data, answer content, word tagging
// ============================================================

const ANSWERS = {
  A: {
    text: 'Hold the line. Democratic deterrence is the only language Beijing respects.',
    words: [
      {t:'Hold ',w:'y+'},{t:'the ',w:null},{t:'line. ',w:'y+'},
      {t:'Democratic ',w:'x+'},{t:'deterrence ',w:'y+'},
      {t:'is the only language ',w:null},
      {t:'Beijing ',w:'x+'},{t:'respects.',w:null}
    ]
  },
  B: {
    text: 'We have a moral obligation to defend liberal democratic order, whatever the cost.',
    words: [
      {t:'We have a ',w:null},{t:'moral ',w:'y+'},{t:'obligation ',w:'y+'},
      {t:'to defend ',w:'y+'},{t:'liberal ',w:'x-'},
      {t:'democratic ',w:'x-'},{t:'order, ',w:null},
      {t:'whatever the cost.',w:'y+'}
    ]
  },
  C: {
    text: "Reckless. We're risking war and economic collapse over Taiwan's chip fabs.",
    words: [
      {t:'Reckless. ',w:'y-'},{t:"We're risking ",w:'y-'},
      {t:'war ',w:'y-'},{t:'and ',w:null},
      {t:'economic ',w:'x+'},{t:'collapse ',w:'y-'},
      {t:"over Taiwan's ",w:null},{t:'chip fabs.',w:'x+'}
    ]
  },
  D: {
    text: 'This is imperial posturing serving capital, not the people of Taiwan.',
    words: [
      {t:'This is ',w:null},{t:'imperial ',w:'y-'},
      {t:'posturing ',w:'y-'},{t:'serving ',w:null},
      {t:'capital, ',w:'x-'},{t:'not the ',w:null},
      {t:'people ',w:'x-'},{t:'of Taiwan.',w:null}
    ]
  }
};

const COLORS = { A:'#c94040', B:'#3a5a8c', C:'#4a8c5a', D:'#c87a30' };

// Mock aggregate data for the scatter/heat view
const MOCK = (()=>{
  const pts=[];
  [{cx:0.68,cy:0.28,sp:0.16,n:145,q:'A'},{cx:0.30,cy:0.25,sp:0.14,n:85,q:'B'},
   {cx:0.28,cy:0.72,sp:0.15,n:102,q:'C'},{cx:0.70,cy:0.75,sp:0.13,n:48,q:'D'}
  ].forEach(({cx,cy,sp,n,q})=>{
    for(let i=0;i<n;i++) pts.push({
      x:Math.max(0.02,Math.min(0.98,cx+(Math.random()-0.5)*sp*2)),
      y:Math.max(0.02,Math.min(0.98,cy+(Math.random()-0.5)*sp*2)),
      q, v:Math.floor(Math.random()*100)+1
    });
  });
  return pts;
})();

// Other voices shown after submission
const VOICES = [
  {i:'K', bg:'#c94040', name:'Kyle, 27', meta:'Youngstown, OH', zd:false,
   q:'We have to hold the line. The moment we blink on Taiwan, every alliance we have becomes worthless.', c:'x +68  ·  y +55'},
  {i:'N', bg:'#3a5a8c', name:'Norah, 34', meta:'Portland, OR', zd:true,
   q:"I don't think it's ethical to risk a war over this. But I don't think we have a real choice anymore.", c:'x −40  ·  y −35'},
  {i:'M', bg:'#4a8c5a', name:'Marcus, 41', meta:'Austin, TX', zd:false,
   q:'The semiconductor angle is what nobody wants to say out loud. This is not about democracy.', c:'x +30  ·  y −22'},
];
