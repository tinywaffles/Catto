'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Shield, Users } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';
import type { OtxPulse, CisaKevEntry, NewsArticle } from '@/types/dashboard';

// ── APT Profile types ─────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM';
type SgLevel = 'HIGH' | 'MED' | 'LOW';

interface AptProfile {
  id: string;
  name: string;
  aliases: string[];
  origin: string;
  flag: string;
  severity: Severity;
  sgTargeting: SgLevel;
  sectors: string[];
  sgRelevance: string;
  ttps: string[];
  mitreId: string;
  keywords: string[]; // lowercase, matched against feed text
  description: string;
}

// ── Built-in APT profiles (top 20 SEA-relevant groups) ───────────────────────

const APT_PROFILES: AptProfile[] = [
  {
    id: 'apt41',
    name: 'APT41',
    aliases: ['Double Dragon', 'Winnti', 'Barium', 'Brass Typhoon'],
    origin: 'China (MSS)',
    flag: '🇨🇳',
    severity: 'CRITICAL',
    sgTargeting: 'HIGH',
    sectors: ['Finance', 'Telecom', 'Healthcare', 'Government', 'Gaming'],
    sgRelevance:
      'Documented attacks on Singapore financial institutions and telecom operators. Conducted supply-chain intrusions against Singapore-based software vendors. Targets SG-listed companies for corporate espionage.',
    ttps: ['Supply Chain Compromise (T1195)', 'Spearphishing (T1566)', 'KEYPLUG backdoor', 'MESSAGETAP implant', 'Cobalt Strike'],
    mitreId: 'G0096',
    keywords: ['apt41', 'double dragon', 'winnti', 'barium', 'brass typhoon', 'keyplug', 'messagetap', 'deadeye'],
    description: 'Chinese state-sponsored group conducting both espionage and financially motivated attacks simultaneously. Unique dual mission of intelligence gathering and cybercrime.',
  },
  {
    id: 'lazarus',
    name: 'Lazarus Group',
    aliases: ['Hidden Cobra', 'Zinc', 'Diamond Sleet', 'TraderTraitor'],
    origin: 'North Korea (RGB)',
    flag: '🇰🇵',
    severity: 'CRITICAL',
    sgTargeting: 'HIGH',
    sectors: ['Finance', 'Cryptocurrency', 'Defence', 'Media', 'Aviation'],
    sgRelevance:
      'Repeatedly targeted Singapore cryptocurrency exchanges and DeFi platforms. Used Singapore as a financial conduit for sanctions evasion. MAS has issued multiple advisories on Lazarus targeting SG banks.',
    ttps: ['TraderTraitor (T1059)', 'SWIFT system attacks', 'Watering hole (T1189)', 'AppleJeus malware', 'BlindingCan RAT'],
    mitreId: 'G0032',
    keywords: ['lazarus', 'hidden cobra', 'zinc', 'diamond sleet', 'tradertrait er', 'applejeus', 'blindingcan', 'dprk', 'north korea'],
    description: 'North Korean state-sponsored group responsible for the Bangladesh Bank heist, WannaCry ransomware, and extensive cryptocurrency theft totalling billions of dollars.',
  },
  {
    id: 'apt40',
    name: 'APT40',
    aliases: ['Leviathan', 'TEMP.Periscope', 'Bronze Mohawk', 'GADOLINIUM'],
    origin: 'China (MSS Hainan)',
    flag: '🇨🇳',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['Maritime', 'Government', 'Defence', 'Research', 'Engineering'],
    sgRelevance:
      'Singapore\'s role as the world\'s largest transshipment hub makes it a prime target. APT40 actively targets maritime logistics, port authorities, and naval research entities in SEA. Attributed to MSS Hainan bureau.',
    ttps: ['Phishing (T1566)', 'Web shell deployment (T1505.003)', 'ScanBox framework', 'AIRBREAK backdoor', 'Living off the Land'],
    mitreId: 'G0065',
    keywords: ['apt40', 'leviathan', 'temp.periscope', 'bronze mohawk', 'gadolinium', 'airbreak', 'scanbox'],
    description: 'Chinese state-sponsored group with a focus on maritime industries, defence contractors, and government organisations across the Indo-Pacific.',
  },
  {
    id: 'apt10',
    name: 'APT10',
    aliases: ['Stone Panda', 'menuPass', 'Potassium', 'Bronze Riverside'],
    origin: 'China (MSS Tianjin)',
    flag: '🇨🇳',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['Managed Service Providers', 'Telecom', 'Government', 'Healthcare', 'Finance'],
    sgRelevance:
      'Operation Cloud Hopper compromised MSPs with Singapore operations, enabling downstream client access. Singapore telecom operators are high-priority targets given their regional interconnect role.',
    ttps: ['MSP compromise (T1199)', 'PlugX RAT', 'RedLeaves backdoor', 'Cloud Hopper TTPs', 'Credential dumping (T1003)'],
    mitreId: 'G0045',
    keywords: ['apt10', 'stone panda', 'menupass', 'potassium', 'bronze riverside', 'cloud hopper', 'plugx', 'redleaves'],
    description: 'Chinese espionage group responsible for Operation Cloud Hopper — the largest known MSP supply-chain campaign, affecting managed service providers globally.',
  },
  {
    id: 'naikon',
    name: 'Naikon',
    aliases: ['Override Panda', 'PLA Unit 78020', 'Lotus Panda'],
    origin: 'China (PLA)',
    flag: '🇨🇳',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['Government', 'Military', 'Diplomatic', 'ASEAN Institutions'],
    sgRelevance:
      'Historically targeted ASEAN foreign ministries including Singapore MFA. Known to infiltrate government networks for geopolitical intelligence ahead of ASEAN summits. Operates across the SCS dispute zone.',
    ttps: ['Aria-body backdoor', 'XSControl framework', 'Spearphishing attachments', 'RoyalRoad lure documents'],
    mitreId: 'G0019',
    keywords: ['naikon', 'override panda', 'pla unit 78020', 'lotus panda', 'aria-body', 'xscontrol'],
    description: 'Chinese PLA-linked group operating almost exclusively in Southeast Asia, targeting government ministries and military entities across ASEAN member states.',
  },
  {
    id: 'darktpink',
    name: 'Dark Pink',
    aliases: ['Saavy Seahorse', 'SAAVY SEAHORSE'],
    origin: 'Unknown (SEA)',
    flag: '🌏',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['Government', 'Military', 'Education', 'Religious Orgs', 'Defence Contractors'],
    sgRelevance:
      'Specifically targets ASEAN government and military entities. Singapore government agencies and defence contractors are within documented targeting scope. Group operates primarily in Southeast Asia.',
    ttps: ['KamiKakaBot implant', 'TelePowerBot Telegram C2', 'Cucky/Ctealer stealers', 'ISO lure files', 'DLL sideloading'],
    mitreId: 'G1027',
    keywords: ['dark pink', 'saavy seahorse', 'kamikaka bot', 'telepowerbot', 'cucky', 'ctealer'],
    description: 'Advanced threat actor operating exclusively in Southeast Asia, targeting government, military, and education sectors. Uses Telegram as C2 infrastructure.',
  },
  {
    id: 'blacktech',
    name: 'BlackTech',
    aliases: ['Palmerworm', 'Circuit Panda', 'Radio Panda', 'TEMP.Overboard'],
    origin: 'China / Taiwan-nexus',
    flag: '🇨🇳',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['Technology', 'Government', 'Defence', 'Telecom', 'Electronics'],
    sgRelevance:
      'Targets technology companies with Singapore subsidiaries to pivot to parent organisations. Known to compromise Cisco router firmware to persist in regional telco networks, including those operating in Singapore.',
    ttps: ['Router firmware implants (T1542.001)', 'PLEAD backdoor', 'TSCookie RAT', 'Supply chain (T1195)', 'Cisco IOS implant'],
    mitreId: 'G0098',
    keywords: ['blacktech', 'palmerworm', 'circuit panda', 'radio panda', 'temp.overboard', 'plead', 'tscookie'],
    description: 'Chinese-linked group with long-standing persistence in Asia-Pacific technology and government networks, known for router-level implants to maintain covert access.',
  },
  {
    id: 'mustangpanda',
    name: 'Mustang Panda',
    aliases: ['Bronze President', 'TA416', 'RedDelta', 'Earth Preta'],
    origin: 'China',
    flag: '🇨🇳',
    severity: 'HIGH',
    sgTargeting: 'MED',
    sectors: ['Government', 'NGOs', 'Religious Orgs', 'Diplomatic', 'Think Tanks'],
    sgRelevance:
      'Active across ASEAN region targeting diplomatic missions and government agencies. Singapore-based regional NGOs and diplomatic corps are within scope. Uses PlugX and TONESHELL for persistent access.',
    ttps: ['PlugX RAT (T1059)', 'TONESHELL backdoor', 'ShadowPad', 'Spearphishing (T1566)', 'USB propagation (T1091)'],
    mitreId: 'G0129',
    keywords: ['mustang panda', 'bronze president', 'ta416', 'reddelta', 'earth preta', 'toneshell', 'shadowpad'],
    description: 'Prolific Chinese espionage group targeting government and civil society organisations globally, with consistent focus on Southeast Asia and Central Asia.',
  },
  {
    id: 'volttyphoon',
    name: 'Volt Typhoon',
    aliases: ['Bronze Silhouette', 'Dev-0391', 'VANGUARD PANDA', 'Insidious Taurus'],
    origin: 'China (PLA)',
    flag: '🇨🇳',
    severity: 'CRITICAL',
    sgTargeting: 'MED',
    sectors: ['Critical Infrastructure', 'Energy', 'Water', 'Transport', 'Communications'],
    sgRelevance:
      'Pre-positioning in critical infrastructure for potential disruption during geopolitical crises. Singapore\'s dense critical infrastructure concentration makes it a strategic target for pre-positioned access.',
    ttps: ['Living off the Land (T1218)', 'SOHO router compromise', 'KV Botnet', 'Credential access (T1003)', 'No malware — LOLBins only'],
    mitreId: 'G1017',
    keywords: ['volt typhoon', 'bronze silhouette', 'vanguard panda', 'insidious taurus', 'kv botnet', 'dev-0391'],
    description: 'Chinese state-sponsored group focused on pre-positioning within critical infrastructure for potential disruption operations, not traditional espionage.',
  },
  {
    id: 'salttyphoon',
    name: 'Salt Typhoon',
    aliases: ['Ghost Emperor', 'FamousSparrow', 'Earth Estries', 'UNC2286'],
    origin: 'China (MSS)',
    flag: '🇨🇳',
    severity: 'CRITICAL',
    sgTargeting: 'HIGH',
    sectors: ['Telecom', 'ISPs', 'Government', 'Defence'],
    sgRelevance:
      'Specifically targets telecommunications providers for lawful intercept system access. Singapore\'s role as a major regional internet exchange and submarine cable hub makes SG telcos high-priority targets.',
    ttps: ['Lawful intercept system access', 'GhostSpider backdoor', 'SparrowDoor RAT', 'DEMODEX rootkit', 'Router exploitation'],
    mitreId: 'G1045',
    keywords: ['salt typhoon', 'ghost emperor', 'famoussparrow', 'earth estries', 'unc2286', 'ghostspider', 'sparrowdoor', 'demodex'],
    description: 'Chinese group that compromised major US and global telcos to access lawful intercept systems. Considered one of the most significant cyber espionage operations against telecom infrastructure.',
  },
  {
    id: 'apt38',
    name: 'APT38',
    aliases: ['Bluenoroff', 'Stardust Chollima', 'BeagleBoyz'],
    origin: 'North Korea (RGB)',
    flag: '🇰🇵',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['Banking', 'Finance', 'SWIFT Network'],
    sgRelevance:
      'Focuses exclusively on financial theft via SWIFT network attacks. Singapore banks with SWIFT connectivity are documented targets. MAS SWIFT advisory issued specifically in response to APT38 activity.',
    ttps: ['SWIFT manipulation (T1657)', 'FASTCash ATM cashout', 'WhiskeyAlfa RAT', 'HOPLIGHT backdoor', 'TAINTEDSCRIBE'],
    mitreId: 'G0082',
    keywords: ['apt38', 'bluenoroff', 'stardust chollima', 'beagleboyz', 'fastcash', 'hoplight', 'whiskeyalfa'],
    description: 'North Korean financial crime unit responsible for billions in bank heists via SWIFT network manipulation, operating separately from Lazarus Group espionage operations.',
  },
  {
    id: 'apt32',
    name: 'APT32',
    aliases: ['OceanLotus', 'SeaLotus', 'Cobalt Kitty', 'Canvas Cyclone'],
    origin: 'Vietnam (MPS)',
    flag: '🇻🇳',
    severity: 'HIGH',
    sgTargeting: 'MED',
    sectors: ['Private Sector', 'Manufacturing', 'Government', 'Automotive', 'Hospitality'],
    sgRelevance:
      'Vietnamese state-linked group targeting foreign businesses operating in Vietnam and ASEAN. Singapore-headquartered MNCs with Vietnam operations have been targeted to access parent company networks.',
    ttps: ['Cobalt Strike', 'WINDSHIELD malware', 'SOUNDBITE backdoor', 'Macro lures (T1566.001)', 'Watering hole (T1189)'],
    mitreId: 'G0050',
    keywords: ['apt32', 'oceanlotus', 'sealotus', 'cobalt kitty', 'canvas cyclone', 'windshield', 'soundbite'],
    description: 'Vietnamese state-sponsored group targeting foreign companies for economic espionage, with focus on automotive, manufacturing, and hospitality sectors.',
  },
  {
    id: 'apt29',
    name: 'APT29',
    aliases: ['Cozy Bear', 'Midnight Blizzard', 'Nobelium', 'YTTRIUM'],
    origin: 'Russia (SVR)',
    flag: '🇷🇺',
    severity: 'CRITICAL',
    sgTargeting: 'MED',
    sectors: ['Government', 'Diplomatic', 'Think Tanks', 'Healthcare', 'Technology'],
    sgRelevance:
      'Targets diplomatic missions and government agencies globally. Singapore\'s diplomatic community and MFA are within scope. Known to compromise embassy networks for intelligence collection.',
    ttps: ['SUNBURST (SolarWinds)', 'MagicWeb (T1556)', 'WellMess', 'FOGGYWEB', 'OAuth token theft (T1528)'],
    mitreId: 'G0016',
    keywords: ['apt29', 'cozy bear', 'midnight blizzard', 'nobelium', 'yttrium', 'sunburst', 'wellmess', 'foggyweb'],
    description: 'Russian SVR intelligence service cyber arm responsible for SolarWinds supply-chain attack and consistent targeting of diplomatic, government, and healthcare entities.',
  },
  {
    id: 'apt28',
    name: 'APT28',
    aliases: ['Fancy Bear', 'Forest Blizzard', 'Sofacy', 'Strontium', 'Pawn Storm'],
    origin: 'Russia (GRU)',
    flag: '🇷🇺',
    severity: 'HIGH',
    sgTargeting: 'MED',
    sectors: ['Government', 'Military', 'Political Orgs', 'Defence', 'Media'],
    sgRelevance:
      'Targets government and military organisations globally. Singapore defence and foreign affairs entities are within scope given APT28\'s broad NATO and partner-country targeting.',
    ttps: ['X-Agent implant', 'Zebrocy', 'LOOKINGGLASS', 'Credential phishing (T1566)', 'Router exploitation (T1542)'],
    mitreId: 'G0007',
    keywords: ['apt28', 'fancy bear', 'forest blizzard', 'sofacy', 'strontium', 'pawn storm', 'x-agent', 'zebrocy'],
    description: 'Russian GRU military intelligence cyber unit with a focus on political influence operations, election interference, and NATO government espionage.',
  },
  {
    id: 'kimsuky',
    name: 'Kimsuky',
    aliases: ['Velvet Chollima', 'Black Banshee', 'Emerald Sleet', 'Thallium'],
    origin: 'North Korea (RGB)',
    flag: '🇰🇵',
    severity: 'HIGH',
    sgTargeting: 'LOW',
    sectors: ['Government', 'Think Tanks', 'Defence', 'Energy', 'Academic'],
    sgRelevance:
      'Primarily targets South Korea and its allies. Singapore policy institutes and government-linked think tanks that engage on Korean Peninsula issues have been targeted for intelligence collection.',
    ttps: ['FlowerPower backdoor', 'AppleSeed RAT', 'RandomQuery', 'Browser credential theft (T1555.003)', 'BabyShark'],
    mitreId: 'G0094',
    keywords: ['kimsuky', 'velvet chollima', 'black banshee', 'emerald sleet', 'thallium', 'appleseed', 'babyshark', 'flowerpower'],
    description: 'North Korean intelligence collection group focused on policy, diplomatic, and nuclear topics. Conducts extensive social engineering of researchers and journalists.',
  },
  {
    id: 'sidewinder',
    name: 'Sidewinder',
    aliases: ['Rattlesnake', 'T-APT-04', 'Hardcore Nationalist'],
    origin: 'India (suspected)',
    flag: '🇮🇳',
    severity: 'MEDIUM',
    sgTargeting: 'MED',
    sectors: ['Government', 'Military', 'Law Enforcement', 'South/SE Asia'],
    sgRelevance:
      'Active across South and Southeast Asia targeting government and military entities. Singapore government and law enforcement agencies are within documented targeting scope.',
    ttps: ['DotNET payloads', 'ReverseRat', 'WarHawk malware', 'Android spyware', 'LNK/RTF lures (T1566.001)'],
    mitreId: 'G0121',
    keywords: ['sidewinder', 'rattlesnake', 't-apt-04', 'hardcore nationalist', 'reverserat', 'warhawk'],
    description: 'Suspected Indian state-linked group conducting intelligence operations across South and Southeast Asia, primarily targeting military and government organisations.',
  },
  {
    id: 'andariel',
    name: 'Andariel',
    aliases: ['Nickel Hyatt', 'Silent Chollima', 'Stonefly', 'DarkSeoul'],
    origin: 'North Korea (RGB)',
    flag: '🇰🇵',
    severity: 'HIGH',
    sgTargeting: 'MED',
    sectors: ['Defence', 'Healthcare', 'Finance', 'Manufacturing'],
    sgRelevance:
      'Conducts ransomware attacks on healthcare and defence sectors for revenue generation. Singapore hospitals and defence manufacturers are within scope as financially motivated targets.',
    ttps: ['Maui ransomware', 'Dtrack RAT', 'Preft backdoor', 'NukeSped', 'MagicRat'],
    mitreId: 'G0138',
    keywords: ['andariel', 'nickel hyatt', 'silent chollima', 'stonefly', 'darkseoul', 'maui', 'dtrack', 'nukesped'],
    description: 'North Korean unit conducting both espionage and ransomware operations against healthcare and defence sectors globally to generate revenue under sanctions.',
  },
  {
    id: 'apt33',
    name: 'APT33',
    aliases: ['Elfin', 'Refined Kitten', 'Peach Sandstorm', 'Magnallium'],
    origin: 'Iran (IRGC)',
    flag: '🇮🇷',
    severity: 'HIGH',
    sgTargeting: 'LOW',
    sectors: ['Aviation', 'Energy', 'Petrochemical', 'Military'],
    sgRelevance:
      'Primarily targets Middle East and US aviation/energy. Singapore\'s Changi Airport and petrochemical sector at Jurong Island are potential targets given APT33\'s sectoral focus.',
    ttps: ['SHAMOON wiper', 'TURNEDUP backdoor', 'STONEDRILL', 'Password spraying (T1110.003)', 'Spearphishing (T1566)'],
    mitreId: 'G0064',
    keywords: ['apt33', 'elfin', 'refined kitten', 'peach sandstorm', 'magnallium', 'shamoon', 'turnedup', 'stonedrill'],
    description: 'Iranian IRGC-linked group targeting aviation, energy, and petrochemical sectors. Known for destructive wiper malware deployed against critical infrastructure.',
  },
  {
    id: 'lockbit',
    name: 'LockBit',
    aliases: ['GOLD MYSTIC', 'Bitwise Spider', 'LockBit 3.0'],
    origin: 'Criminal (Russia-nexus)',
    flag: '🏴',
    severity: 'HIGH',
    sgTargeting: 'HIGH',
    sectors: ['All Sectors', 'Healthcare', 'Finance', 'Government', 'Legal'],
    sgRelevance:
      'Largest ransomware-as-a-service operation globally. Has hit Singapore government agencies, healthcare institutions, and law firms. CSIT and CSA have issued specific advisories on LockBit targeting SG entities.',
    ttps: ['Ransomware-as-a-Service', 'Double extortion (T1486)', 'StealBit exfil tool', 'Cobalt Strike', 'AnyDesk/RDP abuse (T1021.001)'],
    mitreId: 'G0139',
    keywords: ['lockbit', 'gold mystic', 'bitwise spider', 'lockbit 3', 'lockbit 2', 'stealbit'],
    description: 'Most prolific ransomware-as-a-service operation in history. Responsible for thousands of attacks globally including critical infrastructure and healthcare systems.',
  },
  {
    id: 'fin7',
    name: 'FIN7',
    aliases: ['Carbanak Group', 'Carbon Spider', 'Sangria Tempest', 'ANUNAK'],
    origin: 'Criminal (Russia-nexus)',
    flag: '🏴',
    severity: 'HIGH',
    sgTargeting: 'MED',
    sectors: ['Finance', 'Hospitality', 'Retail', 'Technology'],
    sgRelevance:
      'Targets financial institutions and high-value retail globally. Singapore banks, luxury retail, and hospitality sectors are within scope. Known to conduct targeted campaigns against APAC financial institutions.',
    ttps: ['CARBANAK backdoor', 'Cl0p ransomware', 'DICELOADER', 'Spearphishing (T1566)', 'POS system attacks'],
    mitreId: 'G0046',
    keywords: ['fin7', 'carbanak', 'carbon spider', 'sangria tempest', 'anunak', 'diceloader', 'lizar'],
    description: 'Sophisticated financial crime group responsible for over a billion dollars in losses. Conducts highly targeted attacks on financial, hospitality, and retail sectors.',
  },
];

// ── Data keys ─────────────────────────────────────────────────────────────────

const PANEL_KEYS = ['otx_pulses', 'cisa_kev', 'news'] as const;

// ── Matching ─────────────────────────────────────────────────────────────────

interface FeedHit {
  source: 'OTX' | 'CISA KEV' | 'News';
  timestamp: number; // ms
}

function searchText(text: string | undefined | null, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function matchApt(
  profile: AptProfile,
  pulses: OtxPulse[],
  kev: CisaKevEntry[],
  news: NewsArticle[],
): FeedHit[] {
  const hits: FeedHit[] = [];
  const kw = profile.keywords;

  for (const p of pulses) {
    if (
      searchText(p.name, kw) ||
      searchText(p.description, kw) ||
      p.tags?.some((t) => kw.some((k) => t.toLowerCase().includes(k))) ||
      p.malware_families?.some((m) => kw.some((k) => m.display_name.toLowerCase().includes(k)))
    ) {
      const ts = new Date(p.modified || p.created).getTime();
      if (!isNaN(ts)) hits.push({ source: 'OTX', timestamp: ts });
    }
  }

  for (const k of kev) {
    if (
      searchText(k.vulnerabilityName, kw) ||
      searchText(k.shortDescription, kw) ||
      searchText(k.vendorProject, kw)
    ) {
      const ts = new Date(k.dateAdded).getTime();
      if (!isNaN(ts)) hits.push({ source: 'CISA KEV', timestamp: ts });
    }
  }

  for (const n of news) {
    if (searchText(n.title, kw) || searchText(n.summary, kw)) {
      const ts = new Date(n.pub_date).getTime();
      if (!isNaN(ts)) hits.push({ source: 'News', timestamp: ts });
    }
  }

  return hits;
}

// ── Time formatting ───────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

function severityStyle(s: Severity) {
  if (s === 'CRITICAL') return 'text-red-200 border-red-500/80 bg-red-900/40';
  if (s === 'HIGH') return 'text-orange-200 border-orange-500/70 bg-orange-900/30';
  return 'text-yellow-200 border-yellow-500/70 bg-yellow-900/30';
}

function sgStyle(l: SgLevel) {
  if (l === 'HIGH') return 'text-red-200 bg-red-900/50 border-red-500/80';
  if (l === 'MED') return 'text-yellow-200 bg-yellow-900/40 border-yellow-500/70';
  return 'text-zinc-200 bg-zinc-700/40 border-zinc-500/60';
}

// ── Profile expansion card ────────────────────────────────────────────────────

function ProfileCard({ profile, hits }: { profile: AptProfile; hits: FeedHit[] }) {
  const sources = [...new Set(hits.map((h) => h.source))];

  return (
    <div className="mt-2 border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2.5 space-y-2">
      {/* Description */}
      <p className="text-[8.5px] font-mono leading-relaxed text-gray-200">
        {profile.description}
      </p>

      {/* Meta grid */}
      <div className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-1.5">
        <span className="text-[7.5px] font-mono tracking-widest uppercase pt-px text-gray-300">Origin</span>
        <span className="text-[8.5px] font-mono text-white">{profile.flag} {profile.origin}</span>

        <span className="text-[7.5px] font-mono tracking-widest uppercase pt-px text-gray-300">Sectors</span>
        <span className="text-[8.5px] font-mono leading-relaxed text-sky-300">{profile.sectors.join(' · ')}</span>

        <span className="text-[7.5px] font-mono tracking-widest uppercase pt-px text-gray-300">Aliases</span>
        <span className="text-[8.5px] font-mono text-gray-200">{profile.aliases.join(', ')}</span>
      </div>

      {/* SG Relevance */}
      <div>
        <div className="text-[7.5px] font-mono tracking-widest uppercase mb-1 text-gray-300">
          SG Relevance
        </div>
        <p className="text-[8.5px] font-mono leading-relaxed text-gray-200">
          {profile.sgRelevance}
        </p>
      </div>

      {/* TTPs */}
      <div>
        <div className="text-[7.5px] font-mono tracking-widest uppercase mb-1 text-gray-300">
          Known TTPs
        </div>
        <div className="space-y-px">
          {profile.ttps.map((t) => (
            <div key={t} className="flex items-start gap-1.5">
              <span className="text-[8px] leading-4 flex-shrink-0 text-gray-400">·</span>
              <span className="text-[8.5px] font-mono text-gray-200">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Feed sources */}
      {sources.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[7.5px] font-mono uppercase tracking-widest text-gray-300">Seen in</span>
          {sources.map((s) => (
            <span
              key={s}
              className="text-[7px] font-mono px-1 py-px border border-cyan-500/50 bg-cyan-950/30 text-sky-200"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* MITRE link */}
      <a
        href={`https://attack.mitre.org/groups/${profile.mitreId}/`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-[8px] font-mono transition-colors hover:opacity-80 text-sky-300"
      >
        <ExternalLink size={9} />
        MITRE ATT&amp;CK · {profile.mitreId}
      </a>
    </div>
  );
}

// ── Single APT row ────────────────────────────────────────────────────────────

function AptRow({
  profile,
  hits,
  active,
}: {
  profile: AptProfile;
  hits: FeedHit[];
  active: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latestHit = hits.length > 0 ? Math.max(...hits.map((h) => h.timestamp)) : null;

  return (
    <div className={`border-b border-[var(--border-primary)]/40 last:border-0 ${!active ? 'opacity-70' : ''}`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-primary)]/40 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Flag + name */}
        <span className="text-[11px] flex-shrink-0 leading-none">{profile.flag}</span>
        <span className="flex-1 min-w-0">
          <span className="text-[9.5px] font-mono font-bold text-white tracking-wide truncate block">
            {profile.name}
          </span>
          {profile.aliases[0] && (
            <span className="text-[7.5px] font-mono truncate block text-gray-200">
              {profile.aliases[0]}
            </span>
          )}
        </span>

        {/* Severity badge */}
        <span className={`text-[7px] font-mono font-bold px-1 py-px border flex-shrink-0 ${severityStyle(profile.severity)}`}>
          {profile.severity === 'CRITICAL' ? 'CRIT' : profile.severity}
        </span>

        {/* SG badge */}
        <span className={`text-[7px] font-mono px-1 py-px border flex-shrink-0 ${sgStyle(profile.sgTargeting)}`}>
          SG·{profile.sgTargeting}
        </span>

        {/* Time or expand */}
        <div className="flex flex-col items-end flex-shrink-0">
          {latestHit ? (
            <span className="text-[7px] font-mono text-gray-300">{timeAgo(latestHit)}</span>
          ) : null}
          {expanded ? (
            <ChevronUp size={8} className="mt-px text-gray-300" />
          ) : (
            <ChevronDown size={8} className="mt-px text-gray-300" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2">
          <ProfileCard profile={profile} hits={hits} />
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ThreatActorPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { otx_pulses, cisa_kev, news } = useDataKeys(PANEL_KEYS);
  const pulses = (otx_pulses as OtxPulse[] | undefined) ?? [];
  const kev = (cisa_kev as CisaKevEntry[] | undefined) ?? [];
  const articles = (news as NewsArticle[] | undefined) ?? [];

  // Match each profile against live feeds
  const matched = useMemo(() => {
    return APT_PROFILES.map((p) => ({
      profile: p,
      hits: matchApt(p, pulses, kev, articles),
    }));
  }, [pulses, kev, articles]);

  // Sort: active (with hits) first by most recent, then inactive alphabetically
  const sorted = useMemo(() => {
    const active = matched
      .filter((m) => m.hits.length > 0)
      .sort((a, b) => {
        const aMax = Math.max(...a.hits.map((h) => h.timestamp));
        const bMax = Math.max(...b.hits.map((h) => h.timestamp));
        return bMax - aMax;
      });
    const inactive = matched
      .filter((m) => m.hits.length === 0)
      .sort((a, b) => a.profile.name.localeCompare(b.profile.name));
    return [...active, ...inactive];
  }, [matched]);

  const activeCount = sorted.filter((m) => m.hits.length > 0).length;
  const displayed = showAll ? sorted : sorted.slice(0, activeCount > 0 ? Math.max(activeCount, 3) : 5);

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-zinc-100 font-mono flex-shrink-0">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bg-primary)]/40 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <Shield size={11} className="text-red-400 flex-shrink-0" />
        <span className="text-[9px] font-bold tracking-[0.2em] text-white flex-1 text-left uppercase">
          Threat Actors
        </span>
        {activeCount > 0 && (
          <span className="text-[8px] px-1.5 py-px bg-red-500/20 text-red-300 border border-red-500/40 rounded-sm">
            {activeCount} active
          </span>
        )}
        {collapsed ? (
          <ChevronDown size={9} className="flex-shrink-0 text-gray-300" />
        ) : (
          <ChevronUp size={9} className="flex-shrink-0 text-gray-300" />
        )}
      </button>

      {!collapsed && (
        <div className="border-t border-[var(--border-primary)]">
          {/* Legend */}
          <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[var(--border-primary)]/40">
            <span className="text-[7px] font-mono uppercase tracking-widest text-gray-200">SG targeting</span>
            <span className={`text-[7px] font-mono px-1 border ${sgStyle('HIGH')}`}>HIGH</span>
            <span className={`text-[7px] font-mono px-1 border ${sgStyle('MED')}`}>MED</span>
            <span className={`text-[7px] font-mono px-1 border ${sgStyle('LOW')}`}>LOW</span>
          </div>

          {/* Scrollable list */}
          <div>
            {displayed.map(({ profile, hits }) => (
              <AptRow
                key={profile.id}
                profile={profile}
                hits={hits}
                active={hits.length > 0}
              />
            ))}
          </div>

          {/* Show more / less */}
          {sorted.length > displayed.length || showAll ? (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[7.5px] font-mono border-t border-[var(--border-primary)]/40 transition-colors hover:opacity-80 text-gray-200"
            >
              <Users size={8} />
              {showAll
                ? 'Show fewer'
                : `+${sorted.length - displayed.length} more tracked groups`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
