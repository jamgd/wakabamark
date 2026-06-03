import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WakabamarkEngine } from '../src/index.ts';

describe('WakabamarkEngine coverage', () => {
  it('normalizes CRLF and lone CR line endings', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('a\r\nb'), '<p>a b</p>');
    assert.equal(engine.renderHtml('a\rb'), '<p>a b</p>');
    assert.equal(engine.renderHtml('a\r\n\r\nb'), '<p>a</p><p>b</p>');
  });

  it('produces empty output for empty and whitespace-only input', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml(''), '');
    assert.equal(engine.renderHtml('   \n  '), '');
    assert.equal(engine.renderMarkdown(''), '');
    assert.equal(engine.extractPlainText(''), '');
  });

  it('extracts plain text from lists, blockquotes, and code blocks', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.extractPlainText('* a\n* b'), 'a\nb');
    assert.equal(engine.extractPlainText('> hi\n> there'), 'hi\nthere');
    assert.equal(engine.extractPlainText('    code\n    more'), 'code\nmore');
  });

  it('trims trailing punctuation that hugs an autolinked URL', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('(see https://example.com).'),
      '<p>(see <a href="https://example.com" rel="nofollow noopener noreferrer" target="_blank">https://example.com</a>).</p>',
    );
    assert.equal(engine.renderMarkdown('(see https://example.com).'), '(see <https://example.com>).');
  });

  it('linkifies allowed protocols and leaves disallowed ones as text', () => {
    const defaultEngine = new WakabamarkEngine();
    assert.equal(
      defaultEngine.renderHtml('ftp://host/file'),
      '<p><a href="ftp://host/file" rel="nofollow noopener noreferrer" target="_blank">ftp://host/file</a></p>',
    );

    const httpsOnlyEngine = new WakabamarkEngine({ allowedUrlProtocols: ['https:'] });
    assert.equal(httpsOnlyEngine.renderHtml('ftp://host/file'), '<p>ftp://host/file</p>');
  });

  it('treats *, +, and - as a single unordered list', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('* a\n+ b\n- c'), '<ul><li>a</li><li>b</li><li>c</li></ul>');
  });

  it('accepts both tab and four-space indented code blocks', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('\tcode'), '<pre><code>code</code></pre>');
    assert.equal(engine.renderHtml('    code'), '<pre><code>code</code></pre>');
  });
});
