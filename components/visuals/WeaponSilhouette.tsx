import type { Weapon } from "@/lib/types";

const PISTOLS = new Set<Weapon>([
  "Glock-18",
  "USP-S",
  "Desert Eagle",
  "P250",
  "Five-SeveN",
  "Tec-9",
  "CZ75-Auto",
  "Dual Berettas",
  "P2000",
  "R8 Revolver",
]);

const SNIPERS = new Set<Weapon>(["SSG 08", "SCAR-20", "G3SG1"]);

const SMGS = new Set<Weapon>(["MP9", "MAC-10", "MP7", "MP5-SD", "PP-Bizon", "P90", "UMP-45"]);

const SHOTGUNS = new Set<Weapon>(["XM1014", "MAG-7", "Nova", "Sawed-Off"]);

const AK_FAMILY = new Set<Weapon>(["AK-47", "Galil AR"]);

function Mark({
  className,
  viewBox,
  d,
}: {
  className?: string;
  viewBox: string;
  d: string;
}) {
  return (
    <svg viewBox={viewBox} className={className} fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d={d} />
    </svg>
  );
}

export function WeaponSilhouette({
  weapon,
  className = "",
}: {
  weapon: Weapon;
  className?: string;
}) {
  if (weapon === "Karambit" || weapon === "Talon Knife") {
    return (
      <Mark
        className={className}
        viewBox="0 0 170 100"
        d="M132 18L156 40 150 68 128 82 114 68 122 50 96 62 72 84 50 92C30 98 14 84 18 66C22 50 42 50 56 64L86 46 110 32 132 18ZM26 72a10 10 0 1 0 20 0 10 10 0 1 0-20 0z"
      />
    );
  }

  if (weapon === "Butterfly Knife") {
    return (
      <Mark
        className={className}
        viewBox="0 0 220 80"
        d="M16 16L70 30 16 44 16 56 78 44 86 52 200 58 208 50 208 44 90 40 90 36 208 32 208 26 200 18 86 24 78 32 16 20ZM35 26a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM35 50a5 5 0 1 0 10 0 5 5 0 1 0-10 0z"
      />
    );
  }

  if (weapon === "Gloves") {
    return (
      <Mark
        className={className}
        viewBox="0 0 140 118"
        d="M46 110L30 96 26 70 34 54 18 48 12 30 22 18 40 22 44 42 46 18 50 6 66 6 64 36 70 6 76 2 92 8 86 38 96 14 108 12 114 28 100 44 112 46 126 50 126 68 108 70 104 88 96 108 78 114 56 112Z"
      />
    );
  }

  if (weapon === "Shadow Daggers") {
    return (
      <Mark
        className={className}
        viewBox="0 0 200 90"
        d="M10 24L50 26 54 14H68L72 26 112 20 122 28 112 36 72 38 68 50H54L50 38 10 40ZM78 48L118 50 122 38H136L140 50 180 44 190 52 180 60 140 62 136 74H122L118 62 78 64Z"
      />
    );
  }

  if (weapon.includes("Knife") || weapon.includes("Bayonet")) {
    return (
      <Mark
        className={className}
        viewBox="0 0 240 70"
        d="M12 28H58L62 14H80L84 28 208 20 232 32 208 44 84 42 80 56H62L58 42H12Z M28 35a6 6 0 1 0 12 0 6 6 0 1 0-12 0z"
      />
    );
  }

  if (weapon === "AWP") {
    return (
      <Mark
        className={className}
        viewBox="0 0 280 90"
        d="M8 40L12 28 48 24 56 34H70V12L78 6H170L178 12V34L248 36 250 24H274L276 44 250 46 178 46 168 64H140L134 48 86 50 94 78H72L66 50 56 52 10 56Z"
      />
    );
  }

  if (SNIPERS.has(weapon)) {
    return (
      <Mark
        className={className}
        viewBox="0 0 270 84"
        d="M8 38L12 26 48 24 56 32H68V14L78 8H148L158 14V32L238 34 240 22H262L264 44 240 46 158 48 148 62H124L118 50 82 52 88 74H68L62 52 56 54 8 56Z"
      />
    );
  }

  if (weapon === "USP-S") {
    return (
      <Mark
        className={className}
        viewBox="0 0 190 90"
        d="M14 20V16H108L122 20H172L174 32H122L108 38H70L78 80 74 84H58L48 42 32 38 24 30H14ZM78 42H100L98 56 76 54Z"
      />
    );
  }

  if (PISTOLS.has(weapon)) {
    return (
      <Mark
        className={className}
        viewBox="0 0 170 90"
        d="M14 20V16H108L122 20H136V28H120L108 38H70L78 80 74 84H58L48 42 32 38 24 30H14ZM78 42H100L98 56 76 54Z"
      />
    );
  }

  if (AK_FAMILY.has(weapon)) {
    return (
      <Mark
        className={className}
        viewBox="0 0 260 100"
        d="M6 36L48 26H70V14H94V24L138 22 142 10H156L154 24 208 28 210 12H226L224 28 246 30 258 26 260 42 246 44 154 48 146 52H122L118 62 120 76 132 90H148L156 76 152 52H64L70 84 50 88 40 52 48 48 6 54Z"
      />
    );
  }

  if (SHOTGUNS.has(weapon)) {
    return (
      <Mark
        className={className}
        viewBox="0 0 250 80"
        d="M8 30V50L46 44 54 26H90L94 16H108V26L230 30 240 24H248V44L230 44 136 46 132 56H100V46L70 48 76 72 56 74 48 48Z"
      />
    );
  }

  if (SMGS.has(weapon)) {
    return (
      <Mark
        className={className}
        viewBox="0 0 200 88"
        d="M12 36L30 30H44L50 18H72L128 16 150 26 172 28 174 40 148 42 132 50H84L88 78H66L58 52H44L22 54 12 48Z"
      />
    );
  }

  return (
    <Mark
      className={className}
      viewBox="0 0 250 90"
      d="M8 34V50L40 46 42 28H70V16H92V26H130L132 14H144V26L200 30 202 20H214V28L230 28 236 22H242V40L236 40 230 36 144 40 142 46H118V72H100V46H70L76 74 58 76 50 48H40Z"
    />
  );
}
