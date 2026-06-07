import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WakabamarkEngine } from '../src/index.ts';

describe('WakabamarkEngine', () => {
  it('renders plain text safely to HTML and Markdown', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    assert.equal(engine.renderMarkdown('<script>alert(1)</script>'), '\\<script>alert(1)\\</script>');
  });

  it('renders official inline wakabamark syntax', () => {
    const engine = new WakabamarkEngine();
    const input = 'See *italic*, _also italic_, **bold**, __also bold__, `code`, https://example.com, and >>123.';

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
    assert.equal(engine.renderMarkdown('Use `**literal** and >>123` here.'), 'Use `**literal** and >>123` here.');
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
      '<ul><li>first</li><li>second</li></ul><ol><li>one</li><li>two</li></ol><blockquote class="wakabamark-blockquote"><p>&gt; quoted</p></blockquote><pre><code>const answer = 42;\nconsole.log(answer);</code></pre>',
    );
    assert.equal(
      engine.renderMarkdown(input),
      [
        '- first',
        '- second',
        '',
        '1. one',
        '2. two',
        '',
        '> quoted',
        '',
        '    const answer = 42;',
        '    console.log(answer);',
      ].join('\n'),
    );
  });

  it('supports blockquotes without a space after the marker', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('>quoted'),
      '<blockquote class="wakabamark-blockquote"><p>&gt;quoted</p></blockquote>',
    );
    assert.equal(engine.renderMarkdown('>quoted'), '>quoted');
  });

  it('preserves blockquote spacing after the opening marker', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('> quote'),
      '<blockquote class="wakabamark-blockquote"><p>&gt; quote</p></blockquote>',
    );
    assert.equal(engine.renderMarkdown('> quote'), '> quote');
    assert.equal(
      engine.renderHtml('>quote'),
      '<blockquote class="wakabamark-blockquote"><p>&gt;quote</p></blockquote>',
    );
    assert.equal(engine.renderMarkdown('>quote'), '>quote');
  });

  it('supports custom blockquote class names', () => {
    const engine = new WakabamarkEngine({
      html: {
        blockquoteClassName: 'chan-quote',
      },
    });

    assert.equal(engine.renderHtml('> quoted'), '<blockquote class="chan-quote"><p>&gt; quoted</p></blockquote>');
  });

  it('splits paragraphs on blank lines', () => {
    const engine = new WakabamarkEngine();

    assert.equal(
      engine.renderHtml('First paragraph\n\nSecond paragraph'),
      '<p>First paragraph</p><p>Second paragraph</p>',
    );
    assert.equal(engine.renderMarkdown('First paragraph\n\nSecond paragraph'), 'First paragraph\n\nSecond paragraph');
  });

  it('preserves line breaks inside a paragraph', () => {
    const engine = new WakabamarkEngine();
    const input = 'just text\njust text\njust text';

    assert.equal(engine.renderHtml(input), '<p>just text<br />just text<br />just text</p>');
    assert.equal(engine.renderMarkdown(input), 'just text\njust text\njust text');
    assert.equal(engine.extractPlainText(input), 'just text\njust text\njust text');
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
      '<span class="wakabamark-spoiler">secret</span> [>>123](/thread/42#reply-123)',
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
    assert.equal(engine.renderMarkdown('See >>123.'), 'See [>>123](/thread/42#reply-123).');
    assert.equal(
      engine.renderHtml('>>123'),
      '<p><a href="/thread/42#reply-123" data-post-ref="123">&gt;&gt;123</a></p>',
    );
    assert.equal(engine.renderMarkdown('>>123'), '[>>123](/thread/42#reply-123)');
  });

  it('matches post references only when exactly two opening angle brackets are present', () => {
    const engine = new WakabamarkEngine({
      features: {
        postReferences: true,
      },
      resolvePostReferenceHref: postId => `/thread/42#reply-${postId}`,
    });

    assert.equal(engine.renderHtml('>>>123'), '<p>&gt;&gt;&gt;123</p>');
    assert.equal(engine.renderMarkdown('>>>123'), '>>>123');
  });

  it('leaves bbcode disabled by default', () => {
    const engine = new WakabamarkEngine();
    const input = '[B]bold[/B] [spoiler]secret[/spoiler]';

    assert.equal(engine.renderHtml(input), '<p>[B]bold[/B] [spoiler]secret[/spoiler]</p>');
    assert.equal(engine.renderMarkdown(input), '\\[B\\]bold\\[/B\\] \\[spoiler\\]secret\\[/spoiler\\]');
  });

  it('renders supported BBCodes when the feature flag is enabled', () => {
    const engine = new WakabamarkEngine({
      features: {
        bbCodes: true,
      },
    });

    const input =
      '[B]bold[/B] [I]italic[/I] [U]under[/U] [S]strike[/S] [SPOILER]secret[/SPOILER] [SUP]up[/SUP] [SUB]down[/SUB]';

    assert.equal(
      engine.renderHtml(input),
      '<p><strong>bold</strong> <em>italic</em> <u>under</u> <s>strike</s> <span class="wakabamark-spoiler">secret</span> <sup>up</sup> <sub>down</sub></p>',
    );
    assert.equal(
      engine.renderMarkdown(input),
      '**bold** *italic* <u>under</u> <s>strike</s> <span class="wakabamark-spoiler">secret</span> <sup>up</sup> <sub>down</sub>',
    );
  });

  it('supports mixed-case bbcode tags and nested inline content', () => {
    const engine = new WakabamarkEngine({
      features: {
        bbCodes: true,
        postReferences: true,
      },
      resolvePostReferenceHref: postId => `/thread/42#reply-${postId}`,
    });

    const input = '[b][I]mix[/i] https://example.com >>123[/B]';

    assert.equal(
      engine.renderHtml(input),
      '<p><strong><em>mix</em> <a href="https://example.com" rel="nofollow noopener noreferrer" target="_blank">https://example.com</a> <a href="/thread/42#reply-123" data-post-ref="123">&gt;&gt;123</a></strong></p>',
    );
    assert.equal(engine.renderMarkdown(input), '***mix* <https://example.com> [>>123](/thread/42#reply-123)**');
    assert.equal(engine.extractPlainText(input), 'mix https://example.com >>123');
  });

  it('parses classic inline markup nested inside bbcode containers', () => {
    const engine = new WakabamarkEngine({
      features: {
        bbCodes: true,
        spoilers: true,
      },
    });

    assert.equal(engine.renderHtml('[B]*x*[/B]'), '<p><strong><em>x</em></strong></p>');
    assert.equal(engine.renderMarkdown('[B]*x*[/B]'), '***x***');
    assert.equal(
      engine.renderHtml('[SPOILER]**x**[/SPOILER] [B]%%x%%[/B]'),
      '<p><span class="wakabamark-spoiler"><strong>x</strong></span> <strong><span class="wakabamark-spoiler">x</span></strong></p>',
    );
    assert.equal(
      engine.renderMarkdown('[SPOILER]**x**[/SPOILER] [B]%%x%%[/B]'),
      '<span class="wakabamark-spoiler">**x**</span> **<span class="wakabamark-spoiler">x</span>**',
    );
  });

  it('parses bbcode nested inside classic inline delimiters', () => {
    const engine = new WakabamarkEngine({
      features: {
        bbCodes: true,
        spoilers: true,
      },
    });

    assert.equal(engine.renderHtml('*[B]x[/B]*'), '<p><em><strong>x</strong></em></p>');
    assert.equal(engine.renderMarkdown('*[B]x[/B]*'), '***x***');
    assert.equal(
      engine.renderHtml('%%[B]x[/B]%%'),
      '<p><span class="wakabamark-spoiler"><strong>x</strong></span></p>',
    );
    assert.equal(engine.renderMarkdown('%%[B]x[/B]%%'), '<span class="wakabamark-spoiler">**x**</span>');
    assert.equal(engine.renderHtml('**[I]x[/I]**'), '<p><strong><em>x</em></strong></p>');
    assert.equal(engine.renderMarkdown('**[I]x[/I]**'), '***x***');
  });

  it('does not parse bbcode inside code spans and leaves malformed tags as text', () => {
    const engine = new WakabamarkEngine({
      features: {
        bbCodes: true,
      },
    });

    assert.equal(
      engine.renderHtml('`[B]literal[/B]` [B]open [I]broken[/B] [I][text/I]'),
      '<p><code>[B]literal[/B]</code> <strong>open [I]broken</strong> [I][text/I]</p>',
    );
    assert.equal(
      engine.renderMarkdown('`[B]literal[/B]` [B]open [I]broken[/B] [I][text/I]'),
      '`[B]literal[/B]` **open \\[I\\]broken** \\[I\\]\\[text/I\\]',
    );
  });

  it('keeps classic spoilers working alongside bbcode spoilers', () => {
    const engine = new WakabamarkEngine({
      features: {
        spoilers: true,
        bbCodes: true,
      },
    });

    assert.equal(
      engine.renderHtml('%%old%% [spoiler]new[/SPOILER]'),
      '<p><span class="wakabamark-spoiler">old</span> <span class="wakabamark-spoiler">new</span></p>',
    );
    assert.equal(
      engine.renderMarkdown('%%old%% [spoiler]new[/SPOILER]'),
      '<span class="wakabamark-spoiler">old</span> <span class="wakabamark-spoiler">new</span>',
    );
  });

  it('emits a bracketed Markdown link when an autolink URL contains ">"', () => {
    const engine = new WakabamarkEngine();
    const input = 'https://example.com/a>b';

    assert.equal(engine.renderMarkdown(input), '[https://example.com/a>b](https://example.com/a>b)');
    assert.equal(
      engine.renderHtml(input),
      '<p><a href="https://example.com/a&gt;b" rel="nofollow noopener noreferrer" target="_blank">https://example.com/a&gt;b</a></p>',
    );
  });

  it('widens the Markdown code-span fence past the longest internal backtick run', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('````x```y````'), '<p><code>x```y</code></p>');
    assert.equal(engine.renderMarkdown('````x```y````'), '````x```y````');
  });

  it('renders code spans with very many backtick groups without throwing', () => {
    const engine = new WakabamarkEngine();
    const input = `\`\`a${'`a'.repeat(200_000)}\`\``;

    assert.doesNotThrow(() => engine.renderMarkdown(input));
  });

  it('never turns unsafe protocols into links even when explicitly allowed', () => {
    const engine = new WakabamarkEngine({
      allowedUrlProtocols: ['javascript:'],
    });

    assert.equal(engine.renderHtml('javascript://alert(1)'), '<p>javascript://alert(1)</p>');
    assert.equal(engine.renderMarkdown('javascript://alert(1)'), 'javascript://alert(1)');
  });
});
