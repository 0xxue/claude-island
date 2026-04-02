/**
 * Pet Module — Independent pet system for Claude Island
 *
 * Usage:
 *   const pet = new IslandPet('octopus');
 *   pet.setState('working');
 *   pet.getSpeech('editing');  // → "Let me help with that!"
 *   pet.getEmoji();            // → "🐙"
 */

const PET_TYPES = {
  octopus: { emoji: '🐙', name: 'Octopi' },
  cat:     { emoji: '🐱', name: 'Whiskers' },
  dragon:  { emoji: '🐲', name: 'Drakey' },
  robot:   { emoji: '🤖', name: 'Botty' },
  ghost:   { emoji: '👻', name: 'Boo' },
  crab:    { emoji: '🦀', name: 'Clawford' },
  penguin: { emoji: '🐧', name: 'Waddle' },
  owl:     { emoji: '🦉', name: 'Hooty' },
  fox:     { emoji: '🦊', name: 'Foxy' },
  alien:   { emoji: '👾', name: 'Zorp' },
};

// Pet action icons per state
const PET_ACTIONS = {
  idle:       { icon: '', css: 'idle' },
  sleeping:   { icon: '', css: 'idle' },
  reading:    { icon: '📖', css: 'working' },
  editing:    { icon: '✏️', css: 'working' },
  writing:    { icon: '📝', css: 'working' },
  searching:  { icon: '🔍', css: 'working' },
  running:    { icon: '⚡', css: 'working' },
  permission: { icon: '🙋', css: 'alert' },
  waiting:    { icon: '💬', css: 'idle' },
  complete:   { icon: '🎉', css: 'happy' },
  error:      { icon: '💥', css: 'error' },
};

// Pet speech per state
const PET_SPEECH = {
  idle:       ['Just chilling~', 'Standing by...', 'Anything you need?', 'zzz...'],
  sleeping:   ['zzz...', 'So sleepy...', '*snore*'],
  reading:    ['Reading the code...', 'Hmm, interesting...', 'Let me see...'],
  editing:    ['Fixing things up!', 'Almost there...', 'Making changes...'],
  writing:    ['Writing new code!', 'Creating...', 'Building something cool!'],
  searching:  ['Looking for it...', 'Where is it...', 'Searching...'],
  running:    ['Running command...', 'Executing...', 'On it!'],
  permission: ['Hey! Need your approval!', 'Please check this!', 'Action required!'],
  waiting:    ['Your turn!', 'Waiting for you~', 'Ready when you are!'],
  complete:   ['Done! 🎉', 'All finished!', 'Nailed it!', 'Mission complete!'],
  error:      ['Oops...', 'Something went wrong', 'Oh no...', 'Error occurred!'],
};

class IslandPet {
  constructor(type) {
    this.type = PET_TYPES[type] ? type : 'octopus';
    this.state = 'idle';
    this.listeners = [];
  }

  setType(type) {
    if (PET_TYPES[type]) {
      this.type = type;
      this._notify();
    }
  }

  setState(state) {
    if (PET_ACTIONS[state]) {
      this.state = state;
      this._notify();
    }
  }

  getEmoji() {
    return PET_TYPES[this.type].emoji;
  }

  getName() {
    return PET_TYPES[this.type].name;
  }

  getActionIcon() {
    return PET_ACTIONS[this.state]?.icon || '';
  }

  getCssClass() {
    return PET_ACTIONS[this.state]?.css || 'idle';
  }

  getSpeech() {
    var speeches = PET_SPEECH[this.state] || PET_SPEECH.idle;
    return speeches[Math.floor(Math.random() * speeches.length)];
  }

  // Map tool events to pet states
  mapEvent(eventType, toolName) {
    switch (eventType) {
      case 'tool_start':
        if (toolName === 'Read') return 'reading';
        if (toolName === 'Edit') return 'editing';
        if (toolName === 'Write') return 'writing';
        if (toolName === 'Grep' || toolName === 'Glob') return 'searching';
        if (toolName === 'Bash') return 'running';
        return 'working';
      case 'tool_done': return 'complete';
      case 'permission': return 'permission';
      case 'stop': return 'waiting';
      case 'notification': return 'idle';
      case 'error': return 'error';
      default: return 'idle';
    }
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  _notify() {
    this.listeners.forEach(fn => fn(this));
  }

  static getTypes() {
    return Object.keys(PET_TYPES).map(k => ({
      id: k,
      emoji: PET_TYPES[k].emoji,
      name: PET_TYPES[k].name,
    }));
  }
}

// Export for both browser and Node
if (typeof module !== 'undefined') module.exports = { IslandPet, PET_TYPES, PET_ACTIONS, PET_SPEECH };
if (typeof window !== 'undefined') window.IslandPet = IslandPet;
