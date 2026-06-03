import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WakabamarkEngine } from '../src/index.ts';

describe('WakabamarkEngine', () => {
  it('renders plain text safely to HTML and Markdown', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('<script>alert(1)</script>'),
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
    assert.equal(
      engine.renderMarkdown('<script>alert(1)</script>'),
      '\\<script>alert(1)\\</script>',
    );
  });

  it('renders official inline wakabamark syntax', () => {
    const engine = new WakabamarkEngine();
    const input =
      'See *italic*, _also italic_, **bold**, __also bold__, `code`, https://example.com, and >>123.';

    assert.equal(
      engine.renderHtml(input),
      '<p>See <em>italic</em>, <em>also italic</em>, <strong>bold</strong>, <strong>also bold</strong>, <code>code</code>, <a href="https://example.com" rel="nofollow noopener noreferrer" target="_blank">https://example.com</a>, and &gt;&gt;123.</p>',
    );
    assert.equal(
      engine.renderMarkdown(input),
      'See *italic*, *also italic*, **bold**, **also bold**, `code`, <https://example.com>, and >>123.',
    );
  });

  it('does not parse inline formatting inside code spans', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('Use `**literal** and >>123` here.'),
      '<p>Use <code>**literal** and &gt;&gt;123</code> here.</p>',
    );
    assert.equal(
      engine.renderMarkdown('Use `**literal** and >>123` here.'),
      'Use `**literal** and >>123` here.',
    );
  });

  it('renders official block wakabamark syntax', () => {
    const engine = new WakabamarkEngine();
    const input = [
      '* first',
      '- second',
      '',
      '1. one',
      '2. two',
      '',
      '> quoted',
      '',
      '    const answer = 42;',
      '    console.log(answer);',
    ].join('\n');

    assert.equal(
      engine.renderHtml(input),
      '<ul><li>first</li><li>second</li></ul><ol><li>one</li><li>two</li></ol><blockquote><p>quoted</p></blockquote><pre><code>const answer = 42;\nconsole.log(answer);</code></pre>',
    );
    assert.equal(
      engine.renderMarkdown(input),
      ['- first', '- second', '', '1. one', '2. two', '', '> quoted', '', '    const answer = 42;', '    console.log(answer);'].join('\n'),
    );
  });

  it('supports blockquotes without a space after the marker', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('>quoted'),
      '<blockquote><p>quoted</p></blockquote>',
    );
    assert.equal(engine.renderMarkdown('>quoted'), '> quoted');
  });

  it('splits paragraphs on blank lines', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('First paragraph\n\nSecond paragraph'),
      '<p>First paragraph</p><p>Second paragraph</p>',
    );
    assert.equal(
      engine.renderMarkdown('First paragraph\n\nSecond paragraph'),
      'First paragraph\n\nSecond paragraph',
    );
  });

  it('keeps spoilers disabled by default', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('%%secret%%'), '<p>%%secret%%</p>');
    assert.equal(engine.renderMarkdown('%%secret%%'), '%%secret%%');
  });

  it('supports opt-in spoilers and custom post reference resolution', () => {
    const engine = new WakabamarkEngine({
      features: {
        postReferences: true,
        spoilers: true,
      },
      resolvePostReferenceHref: postId => `/thread/42#reply-${postId}`,
    });

    assert.equal(
      engine.renderHtml('%%secret%% >>123'),
      '<p><span class="wakabamark-spoiler">secret</span> <a href="/thread/42#reply-123" data-post-ref="123">&gt;&gt;123</a></p>',
    );
    assert.equal(
      engine.renderMarkdown('%%secret%% >>123'),
      '>!secret!< [>>123](/thread/42#reply-123)',
    );
  });

  it('allows enabling post-reference parsing explicitly', () => {
    const engine = new WakabamarkEngine({
      features: {
        postReferences: true,
      },
      resolvePostReferenceHref: postId => `/thread/42#reply-${postId}`,
    });

    assert.equal(
      engine.renderHtml('See >>123.'),
      '<p>See <a href="/thread/42#reply-123" data-post-ref="123">&gt;&gt;123</a>.</p>',
    );
    assert.equal(
      engine.renderMarkdown('See >>123.'),
      'See [>>123](/thread/42#reply-123).',
    );
  });

  it('never turns unsafe protocols into links even when explicitly allowed', () => {
    const engine = new WakabamarkEngine({
      allowedUrlProtocols: ['javascript:'],
    });

    assert.equal(
      engine.renderHtml('javascript://alert(1)'),
      '<p>javascript://alert(1)</p>',
    );
    assert.equal(
      engine.renderMarkdown('javascript://alert(1)'),
      'javascript://alert(1)',
    );
  });
});
