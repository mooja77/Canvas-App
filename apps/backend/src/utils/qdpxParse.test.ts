import { describe, it, expect } from 'vitest';
import { parseQdpxProject, describeLosses, buildQdpxXml, toGuid, flattenCodesForInsert } from './qdpxParse.js';

/**
 * Fixtures here follow the REFI-QDA QDA-XML v1.0 schema (Project.xsd, 18 March
 * 2019) rather than whatever QualCanvas happened to emit historically. The
 * structural points that matter and that the old parser got wrong:
 *
 *   Project > CodeBook > Codes > Code   (Codes wrapper; Code nests recursively)
 *   Project > Sources > TextSource > PlainTextContent      (element, not attribute)
 *   TextSource > PlainTextSelection > Coding > CodeRef@targetGUID
 *
 * There is no top-level <Codings> element and no <TextSelection> element in the
 * standard; codings hang off the selection inside the source.
 */

const conformant = `<?xml version="1.0" encoding="utf-8"?>
<Project name="Nested" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook>
    <Codes>
      <Code guid="11111111-1111-4111-8111-111111111111" name="Barriers" isCodable="true" color="#FF0000">
        <Description>Top level theme</Description>
        <Code guid="22222222-2222-4222-8222-222222222222" name="Transport" isCodable="true">
          <Code guid="33333333-3333-4333-8333-333333333333" name="Rural buses" isCodable="true" />
        </Code>
        <Code guid="44444444-4444-4444-8444-444444444444" name="Cost" isCodable="true" />
      </Code>
      <Code guid="55555555-5555-4555-8555-555555555555" name="Enablers" isCodable="true" />
    </Codes>
  </CodeBook>
  <Sources>
    <TextSource guid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" name="Interview 1">
      <PlainTextContent>The bus never comes on time.</PlainTextContent>
      <PlainTextSelection guid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" startPosition="4" endPosition="7">
        <Coding guid="cccccccc-cccc-4ccc-8ccc-cccccccccccc">
          <CodeRef targetGUID="33333333-3333-4333-8333-333333333333" />
        </Coding>
      </PlainTextSelection>
    </TextSource>
  </Sources>
</Project>`;

describe('parseQdpxProject — code hierarchy', () => {
  it('parses nested codes recursively instead of dropping subcodes', () => {
    const result = parseQdpxProject(conformant);

    expect(result.codes).toHaveLength(2);

    const barriers = result.codes[0];
    expect(barriers.name).toBe('Barriers');
    expect(barriers.children.map((c) => c.name)).toEqual(['Transport', 'Cost']);

    const transport = barriers.children[0];
    expect(transport.children.map((c) => c.name)).toEqual(['Rural buses']);
  });

  it('counts every code in the tree, not just the top level', () => {
    const result = parseQdpxProject(conformant);
    expect(result.totalCodes).toBe(5);
  });

  it('reads the Codes wrapper required by the schema', () => {
    // The old parser looked at CodeBook.Code directly, so a conformant file
    // (which always wraps codes in <Codes>) yielded zero codes.
    const result = parseQdpxProject(conformant);
    expect(result.codes.map((c) => c.name)).toEqual(['Barriers', 'Enablers']);
  });
});

describe('parseQdpxProject — unsupported construct reporting', () => {
  // QualCanvas models codes, text sources and text codings. Everything else in
  // the standard is dropped on import. Dropping is acceptable; dropping
  // silently is not, because the researcher is told the import succeeded.
  const rich = `<?xml version="1.0" encoding="utf-8"?>
<Project name="Rich" xmlns="urn:QDA-XML:project:1.0">
  <Users>
    <User guid="99999999-9999-4999-8999-999999999999" name="Researcher" />
  </Users>
  <CodeBook>
    <Codes>
      <Code guid="11111111-1111-4111-8111-111111111111" name="Only code" isCodable="true" />
    </Codes>
  </CodeBook>
  <Variables>
    <Variable guid="v1111111-1111-4111-8111-111111111111" name="Age" typeOfVariable="Integer" />
    <Variable guid="v2222222-2222-4222-8222-222222222222" name="Site" typeOfVariable="Text" />
  </Variables>
  <Cases>
    <Case guid="c1111111-1111-4111-8111-111111111111" name="Participant 1" />
  </Cases>
  <Sources>
    <TextSource guid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" name="Interview">
      <PlainTextContent>Text.</PlainTextContent>
    </TextSource>
    <PDFSource guid="dddddddd-dddd-4ddd-8ddd-dddddddddddd" name="Consent form" path="internal://x.pdf" />
    <AudioSource guid="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" name="Recording" path="internal://x.mp3" />
  </Sources>
  <Notes>
    <Note guid="ffffffff-ffff-4fff-8fff-ffffffffffff" name="Analytic memo">
      <PlainTextContent>A memo.</PlainTextContent>
    </Note>
  </Notes>
  <Sets>
    <Set guid="55555555-5555-4555-8555-555555555550" name="First pass" />
  </Sets>
</Project>`;

  it('counts constructs it cannot import', () => {
    const result = parseQdpxProject(rich);

    expect(result.unsupported.variables).toBe(2);
    expect(result.unsupported.cases).toBe(1);
    expect(result.unsupported.notes).toBe(1);
    expect(result.unsupported.sets).toBe(1);
    expect(result.unsupported.pdfSources).toBe(1);
    expect(result.unsupported.audioSources).toBe(1);
  });

  it('reports nothing unsupported for a project it can fully represent', () => {
    const result = parseQdpxProject(conformant);
    const total = Object.values(result.unsupported).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });

  it('describes losses in prose the importer can show the researcher', () => {
    const result = parseQdpxProject(rich);
    const described = describeLosses(result.unsupported);

    expect(described).toContain('2 variables');
    expect(described).toContain('1 case');
    expect(described).toContain('1 PDF source');
    // Singular vs plural matters — this text goes in front of researchers.
    expect(described).not.toContain('1 cases');
  });

  it('describes nothing when there are no losses', () => {
    expect(describeLosses(parseQdpxProject(conformant).unsupported)).toEqual([]);
  });
});

describe('parseQdpxProject — legacy QualCanvas exports', () => {
  // QualCanvas used to emit a non-conformant shape: no <Codes> wrapper,
  // plainTextContent as an attribute, and a top-level <Codings> block using
  // <TextSelection sourceGUID> + codeGUID. Files researchers already have on
  // disk look like this, so they must keep importing.
  const legacy = `<?xml version="1.0" encoding="utf-8"?>
<Project name="Legacy" origin="CanvasApp" xmlns="urn:QDA-XML:project:1.0">
  <CodeBook>
    <Code guid="code-a" name="Trust" color="#3B82F6" isCodable="true" />
    <Code guid="code-b" name="Access" color="#10B981" isCodable="true" />
  </CodeBook>
  <Sources>
    <TextSource guid="src-a" name="Interview A" plainTextContent="They never called back." creationDateTime="2026-01-01T00:00:00.000Z" />
  </Sources>
  <Codings>
    <Coding guid="coding-a" codeGUID="code-b">
      <TextSelection guid="coding-a-sel" sourceGUID="src-a" startPosition="5" endPosition="11" />
    </Coding>
  </Codings>
</Project>`;

  it('still reads codes when there is no Codes wrapper', () => {
    const result = parseQdpxProject(legacy);
    expect(result.codes.map((c) => c.name)).toEqual(['Trust', 'Access']);
  });

  it('still reads plainTextContent when it is an attribute', () => {
    const result = parseQdpxProject(legacy);
    expect(result.sources[0].plainText).toBe('They never called back.');
  });

  it('maps top-level Codings onto the source they belong to', () => {
    const result = parseQdpxProject(legacy);
    const selections = result.sources[0].selections;

    expect(selections).toHaveLength(1);
    expect(selections[0].startPosition).toBe(5);
    expect(selections[0].endPosition).toBe(11);
    expect(selections[0].codeGuids).toEqual(['code-b']);
  });
});

describe('parseQdpxProject — sources and codings', () => {
  it('reads PlainTextContent as a child element', () => {
    const result = parseQdpxProject(conformant);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].plainText).toBe('The bus never comes on time.');
  });

  it('reads codings from PlainTextSelection > Coding > CodeRef', () => {
    const result = parseQdpxProject(conformant);
    const selections = result.sources[0].selections;

    expect(selections).toHaveLength(1);
    expect(selections[0].startPosition).toBe(4);
    expect(selections[0].endPosition).toBe(7);
    expect(selections[0].codeGuids).toEqual(['33333333-3333-4333-8333-333333333333']);
  });

  it('resolves a coding that targets a nested subcode', () => {
    // Regression guard: the coding above points at a third-level code. If code
    // parsing ever regresses to top-level-only, this coding becomes unresolvable
    // and the excerpt is silently lost.
    const result = parseQdpxProject(conformant);
    const guids = new Set<string>();
    const walk = (cs: typeof result.codes) => cs.forEach((c) => (guids.add(c.guid), walk(c.children)));
    walk(result.codes);

    expect(guids.has(result.sources[0].selections[0].codeGuids[0])).toBe(true);
  });
});

describe('buildQdpxXml — writing a conformant project', () => {
  const project = {
    name: 'Export me',
    createdAt: new Date('2026-03-01T09:00:00.000Z'),
    codes: [
      {
        id: 'ckcode000000000000000001',
        text: 'Barriers',
        color: '#FF0000',
        children: [{ id: 'ckcode000000000000000002', text: 'Transport', color: '#00FF00', children: [] }],
      },
      { id: 'ckcode000000000000000003', text: 'Enablers', color: '#0000FF', children: [] },
    ],
    sources: [{ id: 'cksrc0000000000000000001', title: 'Interview 1', content: 'The bus never comes on time.' }],
    codings: [
      {
        id: 'ckcdg0000000000000000001',
        transcriptId: 'cksrc0000000000000000001',
        questionId: 'ckcode000000000000000002',
        startOffset: 4,
        endOffset: 7,
      },
    ],
  };

  it('emits the Codes wrapper the schema requires', () => {
    expect(buildQdpxXml(project)).toContain('<Codes>');
  });

  it('emits nested codes rather than flattening the hierarchy', () => {
    const parsed = parseQdpxProject(buildQdpxXml(project));

    expect(parsed.codes.map((c) => c.name)).toEqual(['Barriers', 'Enablers']);
    expect(parsed.codes[0].children.map((c) => c.name)).toEqual(['Transport']);
  });

  it('emits PlainTextContent as an element and codings inside the source', () => {
    const parsed = parseQdpxProject(buildQdpxXml(project));

    expect(parsed.sources[0].plainText).toBe('The bus never comes on time.');
    expect(parsed.sources[0].selections).toHaveLength(1);
    expect(parsed.sources[0].selections[0].startPosition).toBe(4);
  });

  it('round-trips a coding onto the nested subcode it belongs to', () => {
    const parsed = parseQdpxProject(buildQdpxXml(project));
    const codedGuid = parsed.sources[0].selections[0].codeGuids[0];

    expect(codedGuid).toBe(parsed.codes[0].children[0].guid);
  });

  it('escapes XML metacharacters in transcript text', () => {
    const risky = {
      ...project,
      sources: [{ id: 'cksrc0000000000000000001', title: 'A & B', content: 'He said <yes> & "no"' }],
    };
    const parsed = parseQdpxProject(buildQdpxXml(risky));

    expect(parsed.sources[0].plainText).toBe('He said <yes> & "no"');
    expect(parsed.sources[0].name).toBe('A & B');
  });

  it('writes GUIDs that satisfy the schema GUID pattern', () => {
    // CUIDs are not GUIDs. Emitting them makes the archive fail validation in
    // stricter importers, which is the whole point of exporting QDPX.
    const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const xml = buildQdpxXml(project);

    for (const guid of [...xml.matchAll(/guid="([^"]+)"/g)].map((m) => m[1])) {
      expect(guid).toMatch(guidPattern);
    }
    for (const target of [...xml.matchAll(/targetGUID="([^"]+)"/g)].map((m) => m[1])) {
      expect(target).toMatch(guidPattern);
    }
  });

  it('maps a given internal id to the same GUID every time', () => {
    expect(toGuid('ckcode000000000000000001')).toBe(toGuid('ckcode000000000000000001'));
    expect(toGuid('ckcode000000000000000001')).not.toBe(toGuid('ckcode000000000000000002'));
  });
});

describe('flattenCodesForInsert — persisting a hierarchy', () => {
  it('returns parents before their children so parent ids already exist', () => {
    const flat = flattenCodesForInsert(parseQdpxProject(conformant).codes);

    expect(flat.map((c) => c.name)).toEqual(['Barriers', 'Transport', 'Rural buses', 'Cost', 'Enablers']);
  });

  it('records each code parent guid so linkage survives', () => {
    const flat = flattenCodesForInsert(parseQdpxProject(conformant).codes);
    const byName = Object.fromEntries(flat.map((c) => [c.name, c]));

    expect(byName['Barriers'].parentGuid).toBeNull();
    expect(byName['Transport'].parentGuid).toBe(byName['Barriers'].guid);
    expect(byName['Rural buses'].parentGuid).toBe(byName['Transport'].guid);
    expect(byName['Cost'].parentGuid).toBe(byName['Barriers'].guid);
    expect(byName['Enablers'].parentGuid).toBeNull();
  });

  it('never lists a child before its parent', () => {
    const flat = flattenCodesForInsert(parseQdpxProject(conformant).codes);
    const seen = new Set<string>();

    for (const code of flat) {
      if (code.parentGuid !== null) expect(seen.has(code.parentGuid)).toBe(true);
      seen.add(code.guid);
    }
  });
});

describe('buildQdpxXml — selections shared by several codes', () => {
  // ATLAS.ti (and NVivo) attach multiple <Coding> children to ONE
  // <PlainTextSelection> when several codes mark the same quotation. Emitting a
  // separate selection per coding round-trips the data but inflates the
  // selection count and loses the "these codes share a quotation" grouping.
  const shared = {
    name: 'Shared',
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    codes: [
      { id: 'ckcodeA00000000000000001', text: 'Cornflakes', color: '#DC0000', children: [] },
      { id: 'ckcodeB00000000000000002', text: 'Happiness', color: '#F00082', children: [] },
    ],
    sources: [{ id: 'cksrcA000000000000000001', title: 'Mabel', content: 'Breakfast is mayhem at our house.' }],
    codings: [
      {
        id: 'ckcdgA000000000000000001',
        transcriptId: 'cksrcA000000000000000001',
        questionId: 'ckcodeA00000000000000001',
        startOffset: 0,
        endOffset: 9,
      },
      {
        id: 'ckcdgB000000000000000002',
        transcriptId: 'cksrcA000000000000000001',
        questionId: 'ckcodeB00000000000000002',
        startOffset: 0,
        endOffset: 9,
      },
    ],
  };

  it('emits one selection carrying both codings when the range is identical', () => {
    const parsed = parseQdpxProject(buildQdpxXml(shared));
    expect(parsed.sources[0].selections).toHaveLength(1);
  });

  it('keeps both code references on that shared selection', () => {
    const parsed = parseQdpxProject(buildQdpxXml(shared));
    expect(parsed.sources[0].selections[0].codeGuids).toHaveLength(2);
    expect(parsed.sources[0].selections[0].codeGuids).toContain(toGuid('ckcodeA00000000000000001'));
    expect(parsed.sources[0].selections[0].codeGuids).toContain(toGuid('ckcodeB00000000000000002'));
  });

  it('still separates selections that cover different ranges', () => {
    const distinct = {
      ...shared,
      codings: [shared.codings[0], { ...shared.codings[1], startOffset: 10, endOffset: 20 }],
    };
    const parsed = parseQdpxProject(buildQdpxXml(distinct));
    expect(parsed.sources[0].selections).toHaveLength(2);
  });
});

describe('parseQdpxProject — uncoded quotations', () => {
  // ATLAS.ti lets a researcher mark a passage without coding it (a quotation
  // with only a Description). QualCanvas has no representation for that, so it
  // vanishes on import — which must be disclosed, not silent.
  const withUncoded = `<?xml version="1.0" encoding="utf-8"?>
<Project name="Quotes" xmlns="urn:QDA-XML:project:1.0">
  <Sources>
    <TextSource guid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" name="Mabel">
      <PlainTextContent>Breakfast is mayhem at our house.</PlainTextContent>
      <PlainTextSelection guid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" startPosition="0" endPosition="9">
        <Description>worth revisiting</Description>
      </PlainTextSelection>
      <PlainTextSelection guid="cccccccc-cccc-4ccc-8ccc-cccccccccccc" startPosition="10" endPosition="16">
        <Coding guid="dddddddd-dddd-4ddd-8ddd-dddddddddddd">
          <CodeRef targetGUID="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" />
        </Coding>
      </PlainTextSelection>
    </TextSource>
  </Sources>
</Project>`;

  it('counts a selection that carries no coding', () => {
    expect(parseQdpxProject(withUncoded).unsupported.uncodedSelections).toBe(1);
  });

  it('does not count selections that do carry a coding', () => {
    const result = parseQdpxProject(withUncoded);
    expect(result.sources[0].selections).toHaveLength(2);
    expect(result.unsupported.uncodedSelections).toBe(1);
  });

  it('describes them for the researcher', () => {
    expect(describeLosses(parseQdpxProject(withUncoded).unsupported)).toContain('1 uncoded quotation');
  });
});

/**
 * Round-trip fidelity. A QDPX archive is how a researcher hands their project
 * to a co-author, deposits it with a journal, or moves it to NVivo. If the text
 * that comes back is not byte-identical to the text that went out, every coding
 * offset in that source points at different words - and nothing detects it,
 * because the importer recomputes codedText from the shifted text, so the
 * `content.slice(start, end) === codedText` invariant still holds on the
 * corrupted row. Both losses below were real and silent.
 */
describe('QDPX text round-trip fidelity', () => {
  const roundTrip = (content: string): string => {
    const xml = buildQdpxXml({
      name: 'Fidelity',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      codes: [{ id: 'code-1', text: 'A code', children: [] }],
      sources: [{ id: 'src-1', title: 'Interview', content }],
      codings: [],
    });
    const parsed = parseQdpxProject(xml);
    return parsed.sources[0].plainText ?? '';
  };

  it('preserves leading and trailing whitespace', () => {
    // fast-xml-parser trims text nodes unless told not to. This exact string
    // came back 43 chars instead of 49, sliding both codings on it.
    const content = '   Leading spaces matter.\n\n\nBlank lines above.   ';
    const out = roundTrip(content);
    expect(out).toBe(content);
    expect(out).toHaveLength(49);
  });

  it('preserves CRLF line endings from Windows- and Word-authored transcripts', () => {
    // XML 1.0 section 2.11 makes a parser normalise literal CR and CRLF to a
    // single LF, so a carriage return only survives as a numeric reference.
    const content = 'Interviewer: How did it start?\r\nParticipant: Slowly.\r\n';
    const out = roundTrip(content);
    expect(out).toBe(content);
    expect(out.split('\r\n')).toHaveLength(3);
  });

  it('keeps every coding offset addressing the same words after a round-trip', () => {
    const content = '  Participant: it was the waiting that broke me.\r\nInterviewer: mm.  ';
    const start = content.indexOf('the waiting');
    const end = start + 'the waiting'.length;
    const out = roundTrip(content);
    expect(out.slice(start, end)).toBe('the waiting');
  });

  it('round-trips text that also needs entity escaping', () => {
    const content = '\r\n  "R&D" <policy> costs 5 & rising\'s worth\r\n';
    expect(roundTrip(content)).toBe(content);
  });
});
