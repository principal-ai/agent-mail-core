/**
 * Adjectives for agent name generation (62 items)
 */
export const ADJECTIVES = [
  // Colors
  "Red",
  "Blue",
  "Green",
  "Gold",
  "Silver",
  "Bronze",
  "Amber",
  "Coral",
  "Jade",
  "Ruby",
  "Pearl",
  "Onyx",
  "Ivory",
  "Ebony",
  "Crimson",
  "Azure",
  // Traits
  "Swift",
  "Bold",
  "Calm",
  "Keen",
  "Wise",
  "Brave",
  "Noble",
  "Loyal",
  "Bright",
  "Clear",
  "Sharp",
  "Quick",
  "Quiet",
  "Steady",
  "Strong",
  "Gentle",
  // Weather
  "Sunny",
  "Misty",
  "Stormy",
  "Frosty",
  "Dusty",
  "Rusty",
  "Mossy",
  "Dewy",
  "Windy",
  "Rainy",
  "Snowy",
  "Cloudy",
  // Time
  "Dawn",
  "Dusk",
  "Night",
  "Noon",
  // Metals/Materials
  "Iron",
  "Steel",
  "Glass",
  "Stone",
  "Silk",
  "Velvet",
  // Misc
  "Wild",
  "Free",
  "True",
  "Pure",
  "Deep",
  "High",
  "Vast",
  "Grand",
] as const;

/**
 * Nouns for agent name generation (69 items)
 */
export const NOUNS = [
  // Nature
  "River",
  "Mountain",
  "Valley",
  "Forest",
  "Desert",
  "Ocean",
  "Island",
  "Canyon",
  "Lake",
  "Stream",
  "Meadow",
  "Grove",
  "Ridge",
  "Peak",
  "Shore",
  "Bay",
  // Animals
  "Fox",
  "Eagle",
  "Wolf",
  "Bear",
  "Hawk",
  "Owl",
  "Deer",
  "Lion",
  "Tiger",
  "Raven",
  "Falcon",
  "Heron",
  "Crane",
  "Swan",
  "Otter",
  "Badger",
  // Structures
  "Tower",
  "Bridge",
  "Castle",
  "Temple",
  "Garden",
  "Harbor",
  "Beacon",
  "Gate",
  "Wall",
  "Fort",
  "Keep",
  "Hall",
  // Plants
  "Oak",
  "Pine",
  "Willow",
  "Cedar",
  "Birch",
  "Maple",
  "Ash",
  "Elm",
  // Sky
  "Star",
  "Moon",
  "Cloud",
  "Storm",
  "Wind",
  "Thunder",
  "Lightning",
  "Aurora",
  // Abstract
  "Summit",
  "Haven",
  "Crest",
  "Crown",
  "Stone",
  "Crystal",
  "Ember",
  "Spark",
  "Shadow",
] as const;

/**
 * Generate a random agent name in CamelCase format.
 *
 * Combines a random adjective with a random noun.
 * Total combinations: 62 x 69 = 4,278 unique names.
 *
 * @example
 * generateAgentName() // "GreenLake"
 * generateAgentName() // "SwiftFox"
 * generateAgentName() // "StormyMountain"
 */
export function generateAgentName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adjective}${noun}`;
}

/**
 * Validate that a name matches the agent name format.
 *
 * Valid names are CamelCase combinations of an adjective and noun
 * from the predefined lists.
 *
 * @param name - Name to validate
 * @returns true if the name is a valid agent name
 *
 * @example
 * validateAgentName("GreenLake")    // true
 * validateAgentName("SwiftFox")     // true
 * validateAgentName("InvalidName")  // false
 * validateAgentName("lowercase")    // false
 */
export function validateAgentName(name: string): boolean {
  // Must match CamelCase pattern
  const pattern = /^[A-Z][a-z]+[A-Z][a-z]+$/;
  if (!pattern.test(name)) {
    return false;
  }

  // Check if it's a valid adjective+noun combination
  for (const adj of ADJECTIVES) {
    if (name.startsWith(adj)) {
      const noun = name.slice(adj.length);
      if ((NOUNS as readonly string[]).includes(noun)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Parse an agent name into its adjective and noun components.
 *
 * @param name - Valid agent name
 * @returns Object with adjective and noun, or null if invalid
 *
 * @example
 * parseAgentName("GreenLake") // { adjective: "Green", noun: "Lake" }
 * parseAgentName("Invalid")   // null
 */
export function parseAgentName(
  name: string
): { adjective: string; noun: string } | null {
  for (const adj of ADJECTIVES) {
    if (name.startsWith(adj)) {
      const noun = name.slice(adj.length);
      if ((NOUNS as readonly string[]).includes(noun)) {
        return { adjective: adj, noun };
      }
    }
  }
  return null;
}
