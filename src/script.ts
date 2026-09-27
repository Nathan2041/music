import { Renderer, StaveNote, Stave, Voice, Formatter, Barline, Stem, Accidental } from 'vexflow';

//#region parameters/setup
type Note = { note: string, duration: string, accidental: string, rest: boolean };
enum Mode {
	Perc,
	Treble
};

// TODO add user paramter
let time: number = 1;

let noteSpacing: number = 30;
let barlineHeight: number = 40; // DO NOT TOUCH
let errorBarlineWidth: number = 2;
let selectedNoteColor: string = '#0153C9';
let barlineGap = 2; // DO NOT TOUCH
let barlineSpace = 5;
let lineOffset = 90;
let staffOffset = 20;
let staveOffset = 50;

await new Promise(resolve => setTimeout(resolve, 0));

let div = document.querySelector('div') as HTMLDivElement;
let renderer = new Renderer(div, Renderer.Backends.SVG);
renderer.resize(window.innerWidth, window.innerHeight);
let context = renderer.getContext();

let pitchedNotes: Note[] = [
	{ note: 'b/4', duration: '1', accidental: '', rest: false },
];

let mode: Mode = Mode.Treble;
let selectedNote: number = 0;

let storageKey = 'vexflow-editor-notes';
let stored = loadFromLocalStorage();
if (stored != null)
{
	pitchedNotes = stored;
}

let fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,application/json';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

fileInput.addEventListener('change', () => {
	let file = fileInput.files?.[0];
	if (!file) { return }
	
	let reader = new FileReader();
	reader.onload = () => {
		try
		{
			let loaded = JSON.parse(reader.result as string);
			if (!Array.isArray(loaded) || loaded.length == 0) return;
			
			pitchedNotes = loaded as Note[];
			selectedNote = 0;
			saveToLocalStorage();
			
			notes = mode == Mode.Perc ? toPercussion(pitchedNotes) : toTreble(pitchedNotes);
			notes[selectedNote].setStyle({ fillStyle: selectedNoteColor, strokeStyle: selectedNoteColor });
			
			context.clear();
			layoutBarProportional(notes, noteSpacing, mode, time);
		}
		catch {}
	};
	reader.readAsText(file);
	
	fileInput.value = '';
});

//#endregion

let pendingOperation: '[' | ']' | 'p' | null = null;
let durationForDigit: Record<string, string> = {
	'1': '1',
	'2': '2',
	'3': '4',
	'4': '8',
	'5': '16',
	'6': '32'
};
let letterOrder = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
let naturalSemitone: Record<string, number> = {
	c: 0,
	d: 2,
	e: 4,
	f: 5,
	g: 7,
	a: 9,
	b: 11
};

// TODO refine inputs
window.addEventListener('keydown', (event) => {
	if (event.key == 'Shift' || event.key == 'Control' || event.key == 'Alt' || event.key == 'Meta') { return }
	let flag: boolean = false;
	
	if (pendingOperation != null)
	{
		let operation = pendingOperation;
		pendingOperation = null;
		
		let duration = durationForDigit[event.key];
		if (duration != undefined)
		{
			if (operation == '[') {
				flag = splitSelectedNote(duration, true);
			}
			else if (operation == ']')
			{
				flag = splitSelectedNote(duration, false);
			}
			else if (operation == 'p')
			{
				flag = setSelectedDuration(duration);
			}
		}
	}
	
	if (event.key == '[' || event.key == ']' || event.key == 'p')
	{
		pendingOperation = event.key;
	}
	
	if (event.key == 'Enter') {
		flag = true;
		mode = mode == Mode.Treble ? Mode.Perc : Mode.Treble;
	}
	
	if (event.key == 'i')
	{
		flag = insertMeasure();
	}
	
	if (event.key == 'd' && pitchedNotes.length != 1) {
		flag = true;
		pitchedNotes.splice(selectedNote, 1);
		if (selectedNote == pitchedNotes.length)
		{
			selectedNote--;
		}
	}
	
	if (event.key == 'n')
	{
		flag = newNote();
	}
	
	if (event.key == 'r')
	{
		flag = true;
		pitchedNotes[selectedNote].rest = !pitchedNotes[selectedNote].rest;
	}
	
	if (event.key == 's' && event.ctrlKey)
	{
		event.preventDefault();
		saveToFile();
	}
	
	if (event.key == 'o' && event.ctrlKey)
	{
		event.preventDefault();
		fileInput.click();
	}
	
	if (event.key == 'ArrowLeft' && selectedNote != 0)
	{
		flag = true;
		selectedNote--;
	}
	
	if (event.key == 'ArrowRight' && selectedNote != pitchedNotes.length - 1)
	{
		flag = true;
		selectedNote++;
	}
	
	if (event.key == 'ArrowUp' && event.ctrlKey)
	{
		flag = true;
		transpose(pitchedNotes[selectedNote], 2, 4);
	}
	
	else if (event.key == 'ArrowUp' && event.shiftKey)
	{
		flag = true;
		transpose(pitchedNotes[selectedNote], 0, 1);
	}
	
	else if (event.key == 'ArrowUp')
	{
		flag = true;
		pitchedNotes[selectedNote].note = `${pitchedNotes[selectedNote].note[0]}${pitchedNotes[selectedNote].note[1]}${+pitchedNotes[selectedNote].note[2] + 1}`;
	}
	
	if (event.key == 'ArrowDown' && event.ctrlKey)
	{
		flag = true;
		transpose(pitchedNotes[selectedNote], -2, -4);
	}
	
	else if (event.key == 'ArrowDown' && event.shiftKey)
	{
		flag = true;
		transpose(pitchedNotes[selectedNote], 0, -1);
	}
	
	else if (event.key == 'ArrowDown')
	{
		flag = true;
		pitchedNotes[selectedNote].note = `${pitchedNotes[selectedNote].note[0]}${pitchedNotes[selectedNote].note[1]}${+pitchedNotes[selectedNote].note[2] - 1}`;
	}
	
	if (!flag) { return }
	saveToLocalStorage();
	
	notes = mode == Mode.Perc ? toPercussion(pitchedNotes) : toTreble(pitchedNotes);
	notes[selectedNote].setStyle({ fillStyle: selectedNoteColor, strokeStyle: selectedNoteColor });
	
	context.clear();
	layoutBarProportional(notes, noteSpacing, mode, time);	
});

// @ts-ignore is this a bug or is it out of scope?
let notes = mode == Mode.Perc ? toPercussion(pitchedNotes) : toTreble(pitchedNotes);
notes[selectedNote].setStyle({ fillStyle: selectedNoteColor, strokeStyle: selectedNoteColor });
layoutBarProportional(notes, noteSpacing, mode, time);

//#region helper-functions
function percussionStave(index: number): Stave
{
	return new Stave(staffOffset, staveOffset + index * lineOffset, 0)
		.addClef('percussion')
		.setContext(context)
		.setConfigForLines([
			{ visible: false },
			{ visible: false },
			{ visible: true },
			{ visible: false },
			{ visible: false },
		])
		.setBegBarType(Barline.type.NONE)
		.setEndBarType(Barline.type.NONE)
}

function trebleStave(index: number): Stave
{
	return new Stave(staffOffset, staveOffset + index * lineOffset, 0).addClef('treble').setContext(context)
}

function toPercussion(pitchedNotes: Note[]): StaveNote[]
{
	return pitchedNotes.map((note) => new StaveNote({ keys: ['b/4'], duration: note.duration + (note.rest ? 'r' : '') }))
}

function toTreble(pitchedNotes: Note[]): StaveNote[]
{
	return pitchedNotes.map((note) => {
		let staveNote = new StaveNote({ keys: [note.note], duration: note.duration + (note.rest ? 'r' : ''), stemDirection: +(note.note[2]) >= 5 ? Stem.DOWN : Stem.UP })
		if (note.accidental)
		{
			staveNote.addModifier(new Accidental(note.accidental), 0);
		}
		return staveNote;
	})
}

function newNote(): boolean
{
	let current = pitchedNotes[selectedNote];
	pitchedNotes.splice(selectedNote + 1, 0, { note: current.note, duration: '4', accidental: '', rest: false });
	selectedNote++;
	return true;
}

function saveToLocalStorage(): void
{
	try
	{
		localStorage.setItem(storageKey, JSON.stringify(pitchedNotes));
	}
	catch {}
}

function loadFromLocalStorage(): Note[] | null
{
	try
	{
		let raw = localStorage.getItem(storageKey);
		if (raw == null) return null;
		
		let parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length == 0) return null;
		
		return parsed as Note[];
	}
	catch
	{
		return null;
	}
}

function saveToFile(): void
{
	let blob = new Blob([JSON.stringify(pitchedNotes, null, 2)], { type: 'application/json' });
	let url = URL.createObjectURL(blob);
	
	let link = document.createElement('a');
	link.href = url;
	link.download = 'sheet-music.json';
	link.click();
	
	URL.revokeObjectURL(url);
}

function accidentalOffset(accidental: string): number
{
	switch(accidental)
	{
		case '#': return 1;
		case 'b': return -1;
		default: return 0;
	}
}

function accidentalForOffset(offset: number): string | null
{
	switch(offset)
	{
		case 0: return '';
		case 1: return '#';
		case -1: return 'b';
		default: return null;
	}
}

function transpose(note: Note, diatonicSteps: number, semitones: number): void
{
	let letter = note.note[0];
	let octave = +note.note[2];
	let currentSemitone = octave * 12 + naturalSemitone[letter] + accidentalOffset(note.accidental);

	let targetSemitone = currentSemitone + semitones;

	for (let stepAdjust of [0, -1, 1])
	{
		let newLetterIndexRaw = letterOrder.indexOf(letter) + diatonicSteps + stepAdjust;
		let newLetterIndex = ((newLetterIndexRaw % 7) + 7) % 7;
		let newOctave = octave + Math.floor(newLetterIndexRaw / 7);
		let newLetter = letterOrder[newLetterIndex];

		let naturalTargetSemitone = newOctave * 12 + naturalSemitone[newLetter];
		let newAccidental = accidentalForOffset(targetSemitone - naturalTargetSemitone);
		if (newAccidental != null)
		{
			note.note = `${newLetter}/${newOctave}`;
			note.accidental = newAccidental;
			return;
		}
	}
}

function durationTicks(duration: string): number
{
	let dots = 0;
	let base = duration;
	while(base.endsWith('d'))
	{
		dots++;
		base = base.slice(0, -1);
	}
	
	let baseTicks = 16384 / Number(base);
	return baseTicks * (2 - Math.pow(0.5, dots));
}

function ticksToDuration(ticks: number): string | null
{
	let bases = ['1', '2', '4', '8', '16', '32', '64', '128'];
	for (let base of bases)
	{
		let baseTicks = 16384 / Number(base);
		if (ticks == baseTicks) return base;
		if (ticks == baseTicks * 1.5) return base + 'd';
		if (ticks == baseTicks * 1.75) return base + 'dd';
	}

	return null;
}

function splitSelectedNote(leftDuration: string, selectLeft: boolean): boolean
{
	let original = pitchedNotes[selectedNote];
	let leftTicks = durationTicks(leftDuration);
	let rightTicks = durationTicks(original.duration) - leftTicks;

	if (leftTicks <= 0 || rightTicks <= 0) return false;

	let rightDuration = ticksToDuration(rightTicks);
	if (rightDuration == null) return false;

	pitchedNotes.splice(selectedNote, 1,
		{ note: original.note, duration: leftDuration, accidental: original.accidental, rest: original.rest },
		{ note: original.note, duration: rightDuration, accidental: original.accidental, rest: original.rest });

	selectedNote = selectLeft ? selectedNote : selectedNote + 1;
	return true;
}

function setSelectedDuration(duration: string): boolean
{
	pitchedNotes[selectedNote].duration = duration;
	return true;
}

function insertMeasure(): boolean
{
	let measureTicks = time * 16384;

	let elapsed = 0;
	for (let i = 0; i <= selectedNote; i++)
	{
		elapsed += durationTicks(pitchedNotes[i].duration);
	}

	let remainder = measureTicks - (elapsed % measureTicks);
	let duration = ticksToDuration(remainder);
	if (duration == null) return false;

	pitchedNotes.splice(selectedNote + 1, 0, { note: pitchedNotes[selectedNote].note, duration, accidental: pitchedNotes[selectedNote].accidental, rest: pitchedNotes[selectedNote].rest });
	selectedNote++;
	return true;
}
//#endregion

function layoutBarProportional(notes: StaveNote[], minSpacingPx: number, mode: Mode, time: number = 1) {
	let preVoice = new Voice({ numBeats: time, beatValue: 1 }).setStrict(false);
	preVoice.addTickables(notes);
	new Formatter().joinVoices([preVoice]).format([preVoice], 0);

	
	let tickPixels = minSpacingPx / Math.log2(Math.min(...notes.map(n => n.getTicks().value())));

	let staveIndex: number = 0;
	let stave = mode == Mode.Perc ? percussionStave(staveIndex) : trebleStave(staveIndex);
	let y = stave.getYForLine(2);
	
	let x = 0;
	let timeElapsed = 0;
	let lastMeasureX = 0;
	let xPositions: number[] = [];
	let lineStartIndex = 0;
	let measureStartIndex = 0;
	let measureStartX = 0;
	
	for (let i = 0; i < notes.length; i++)
	{
		let ticks = notes[i].getTicks().value();
		let step = Math.max(notes[i].getWidth(), Math.log2(ticks) * tickPixels);
		if (stave.getNoteStartX() + x + step > window.innerWidth && i > lineStartIndex)
		{
			let breakIndex = (measureStartIndex > lineStartIndex) ? measureStartIndex : i;
			
			let voice = new Voice({ numBeats: time, beatValue: 1 }).setStrict(false);
			voice.addTickables(notes.slice(lineStartIndex, breakIndex));
			voice.setStave(stave);
			voice.getTickables().forEach(note => note.preFormat());
			
			let lineEndX = (breakIndex == measureStartIndex) ? measureStartX : lastMeasureX;
			stave.setWidth(lineEndX + (stave.getNoteStartX() - stave.getX()));
			
			// let formatter = new Formatter();
			// formatter.joinVoices([voice]);
			// formatter.preCalculateMinTotalWidth([voice]);
			stave.setContext(context).drawWithStyle();
			voice.draw(context, stave);
			stave = mode == Mode.Perc ? percussionStave(++staveIndex) : trebleStave(++staveIndex);
			y = stave.getYForLine(2);
			
			if (breakIndex < i)
			{
				let shift = measureStartX;
				for (let j = breakIndex; j < i; j++)
				{
					xPositions[j] -= shift;
					notes[j].getTickContext().setX(xPositions[j]);
				}
				
				x -= shift;
			}
			else
			{
				x = 0;
			}
			
			lineStartIndex = breakIndex;
			measureStartIndex = breakIndex;
			measureStartX = 0;
			lastMeasureX = 0;
		}
		
		notes[i].getTickContext().setX(x);
		xPositions[i] = x;
		x += step;
		
		timeElapsed += ticks / 16384;
		
		if (timeElapsed >= time && i < (notes.length - 1))
		{
			if (timeElapsed > time)
			{
				context.setLineWidth(errorBarlineWidth);
				context.strokeStyle = 'red';
			}
			
			context.beginPath();
			context.moveTo(stave.getNoteStartX() + x + barlineGap, y - barlineHeight / 2); // might just be an approximation
			context.lineTo(stave.getNoteStartX() + x + barlineGap, y + barlineHeight / 2);
			context.stroke();
			context.setLineWidth(1);
			context.strokeStyle = 'black';
			timeElapsed = 0;
			x += barlineSpace * 2;
			measureStartIndex = i + 1;
			measureStartX = x;
		}
		
		lastMeasureX = x;
	}
	
	let contentWidth = x;
	let staveWidth = contentWidth + (stave.getNoteStartX() - stave.getX());
	stave.setWidth(staveWidth);
	
	let voice = new Voice({ numBeats: time, beatValue: 1 }).setStrict(false);
	voice.addTickables(notes.slice(lineStartIndex));
	voice.setStave(stave);
	voice.getTickables().forEach(note => note.preFormat());
	
	stave.setWidth(lastMeasureX + (stave.getNoteStartX() - stave.getX()));
	
	// let formatter = new Formatter();
	// formatter.joinVoices([voice]);
	// formatter.preCalculateMinTotalWidth([voice]);
	
	stave.setContext(context).drawWithStyle();
	voice.draw(context, stave);
}