import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { WakabamarkEngine, type WakabamarkEnginePlugin } from '../src/index.ts';

describe('WakabamarkEngine security and edge cases', () => {
  it('preserves list continuation lines safely', () => {
    const engine = new WakabamarkEngine();
    const input = ['* first line', '  second line'].join('\n');

    assert.equal(engine.renderHtml(input), '<ul><li>first line<br />second line</li></ul>');
    assert.equal(engine.renderMarkdown(input), ['- first line', '  second line'].join('\n'));
  });

  it('supports code spans with variable backtick fences', () => {
    const engine = new WakabamarkEngine();

    assert.equal(engine.renderHtml('Use ``a`b`` here.'), '<p>Use <code>a`b</code> here.</p>');
    assert.equal(engine.renderMarkdown('Use ``a`b`` here.'), 'Use ``a`b`` here.');
  });

  it('never decodes HTML entities into executable markup', () => {
    const engine = new WakabamarkEngine();
    const input = '&lt;img src=x onerror=alert(1)&gt;';

    assert.equal(engine.renderHtml(input), '<p>&amp;lt;img src=x onerror=alert(1)&amp;gt;</p>');
    assert.equal(engine.renderMarkdown(input), input);
  });

  it('rejects duplicate plugin names during engine construction', () => {
    const duplicatePlugin: WakabamarkEnginePlugin = {
      name: 'mentions',
      parseInline: () => null,
    };

    assert.throws(
      () =>
        new WakabamarkEngine({
          plugins: [duplicatePlugin, duplicatePlugin],
        }),
      /duplicate plugin name/i,
    );
  });

  it('rejects plugin parsers that do not advance the cursor', () => {
    const stuckPlugin: WakabamarkEnginePlugin = {
      name: 'stuck',
      parseInline: ({ input, start }) => {
        if (input[start] !== '@') {
          return null;
        }

        return {
          nodes: [{ type: 'text', value: '@' }],
          nextIndex: start,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [stuckPlugin],
    });

    assert.throws(() => engine.renderHtml('@alice'), /must advance past start/i);
  });

  it('rejects unsafe hrefs returned by plugins', () => {
    const unsafeLinkPlugin: WakabamarkEnginePlugin = {
      name: 'unsafe-link',
      parseInline: ({ input, start }) => {
        if (!input.startsWith('@alice', start)) {
          return null;
        }

        return {
          nodes: [
            {
              type: 'link',
              href: 'javascript:alert(1)',
              text: '@alice',
              external: false,
            },
          ],
          nextIndex: start + '@alice'.length,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [unsafeLinkPlugin],
    });

    assert.throws(() => engine.renderHtml('@alice'), /unsafe href/i);
  });

  it('rejects plugin hrefs that hide a scheme behind control characters', () => {
    const controlCharLinkPlugin = (href: string): WakabamarkEnginePlugin => ({
      name: 'control-char-link',
      parseInline: ({ input, start }) => {
        if (!input.startsWith('@alice', start)) {
          return null;
        }

        return {
          nodes: [{ type: 'link', href, text: '@alice', external: false }],
          nextIndex: start + '@alice'.length,
        };
      },
    });

    // Tab/newline/CR inside the scheme survive escapeHtml but are stripped by the browser during
    // URL resolution, re-forming "javascript:". The href validator must reject them up front.
    for (const href of ['java\tscript:alert(1)', 'javascript\n:alert(1)', 'javascript\r:alert(1)']) {
      const engine = new WakabamarkEngine({ plugins: [controlCharLinkPlugin(href)] });

      assert.throws(() => engine.renderHtml('@alice'), /unsafe href/i);
    }
  });

  it('rejects protocol-relative hrefs returned by plugins', () => {
    const protocolRelativePlugin: WakabamarkEnginePlugin = {
      name: 'protocol-relative-link',
      parseInline: ({ input, start }) => {
        if (!input.startsWith('@alice', start)) {
          return null;
        }

        return {
          nodes: [{ type: 'link', href: '//evil.example/phish', text: '@alice', external: false }],
          nextIndex: start + '@alice'.length,
        };
      },
    };

    const engine = new WakabamarkEngine({ plugins: [protocolRelativePlugin] });

    assert.throws(() => engine.renderHtml('@alice'), /unsafe href/i);
  });

  it('falls back to plain text when a post-reference resolver returns an unsafe href', () => {
    const engine = new WakabamarkEngine({
      features: { postReferences: true },
      resolvePostReferenceHref: () => 'javascript:alert(1)',
    });

    // ">>123" must sit inline (leading ">>" at column 0 is parsed as a blockquote instead).
    assert.equal(engine.renderHtml('See >>123'), '<p>See &gt;&gt;123</p>');
    assert.equal(engine.renderMarkdown('See >>123'), 'See >>123');
  });

  it('does not run inline plugins inside code spans', () => {
    let pluginMatchedInsideCode = false;

    const mentionPlugin: WakabamarkEnginePlugin = {
      name: 'mentions',
      parseInline: ({ input, start }) => {
        if (!input.startsWith('@alice', start)) {
          return null;
        }

        pluginMatchedInsideCode = true;
        return {
          nodes: [
            {
              type: 'link',
              href: '/users/alice',
              text: '@alice',
              external: false,
            },
          ],
          nextIndex: start + '@alice'.length,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [mentionPlugin],
    });

    assert.equal(engine.renderHtml('Use `@alice` here.'), '<p>Use <code>@alice</code> here.</p>');
    assert.equal(pluginMatchedInsideCode, false);
  });

  it('rejects unsupported custom inline node types from plugins in v1', () => {
    const customNodePlugin: WakabamarkEnginePlugin = {
      name: 'emoji',
      parseInline: ({ input, start }) => {
        if (!input.startsWith(':wave:', start)) {
          return null;
        }

        return {
          nodes: [{ type: 'emoji', value: 'wave' } as never],
          nextIndex: start + ':wave:'.length,
        };
      },
    };

    const engine = new WakabamarkEngine({
      plugins: [customNodePlugin],
    });

    assert.throws(() => engine.renderHtml(':wave:'), /unsupported inline node type/i);
  });
});
