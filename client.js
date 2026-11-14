window.__ModuleLoader__.load({
  id: '@local/dsh-guancli-mentions',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'guancli-mentions'
    /** RPC route served by the Host half. */
    const ROUTE = '/guancli-mentions/v1/rpc'
    /** Evidence-panel text: the source name must match `insert.source`. */
    const SOURCE = 'guancli'

    /** Simplified Chinese copy (key-set source of truth). */
    const zh = {
      'section.datasets': '观远数据集',
      'section.pages': '观远看板',
      'section.status': '观远数据',
      'hint.needQuery': '输入关键词搜索观远资产（环境：{env}）',
      'hint.needQuery.description': '切换环境用 @环境名/关键词；已鉴权：{envs}',
      'hint.noMatch': '「{keyword}」在 {env} 没有匹配的数据集或看板',
      'hint.noMatch.description': '换个关键词，或切到其它环境：@环境名/关键词',
      'hint.noEnvironment': 'guancli 还没有已鉴权的 BI 环境',
      'hint.noEnvironment.description': '先执行 guancli auth login 再回来使用 @',
      'hint.noCli': '未找到或无法调用 guancli',
      'hint.noCli.description': '确认 guancli 已安装并可从该用户执行',
      'hint.noGateway': '观远插件未启用，无法搜索资产',
      'hint.noGateway.description': '需安装 @guandata/dsh-guancli 以复用资产检索',
      'hint.error': '观远资产搜索失败',
      'hint.error.description': '稍后重试；若持续失败请检查 BI 连接状态',
      'hint.unknownEnvironment': '环境 {env} 未在 guancli 鉴权',
      'hint.restart': '观远插件需要重启 DSH Desktop 后生效',
      'hint.restart.description': '新版 Host 模块要重启才能加载，重启后刷新页面再试',
      'asset.open': '在侧边栏打开 {name}',
      'asset.openFailed': '打开失败：{reason}',
    }
    const en = {
      'section.datasets': 'Guandata datasets',
      'section.pages': 'Guandata dashboards',
      'section.status': 'Guandata',
      'hint.needQuery': 'Type a keyword to search Guandata assets (environment: {env})',
      'hint.needQuery.description': 'Switch environment with @env/keyword; authenticated: {envs}',
      'hint.noMatch': 'No dataset or dashboard matches "{keyword}" in {env}',
      'hint.noMatch.description': 'Try another keyword, or another environment: @env/keyword',
      'hint.noEnvironment': 'guancli has no authenticated BI environment',
      'hint.noEnvironment.description': 'Run guancli auth login, then use @ again',
      'hint.noCli': 'guancli is missing or not callable',
      'hint.noCli.description': 'Check that guancli is installed and runnable for this user',
      'hint.noGateway': 'The Guandata plugin is disabled, so assets cannot be searched',
      'hint.noGateway.description': 'Install @guandata/dsh-guancli to reuse its asset discovery',
      'hint.error': 'Guandata asset search failed',
      'hint.error.description': 'Retry later; if it persists, check the BI connection',
      'hint.unknownEnvironment': 'Environment {env} is not authenticated in guancli',
      'hint.restart': 'The Guandata plugin needs a DSH Desktop restart',
      'hint.restart.description': 'The new Host module loads only after restart; restart, reload the page, then retry',
      'asset.open': 'Open {name} in the sidebar',
      'asset.openFailed': 'Failed to open: {reason}',
    }
    const ja = {
      'section.datasets': 'Guandata データセット',
      'section.pages': 'Guandata ダッシュボード',
      'section.status': 'Guandata',
      'hint.needQuery': 'キーワードで Guandata アセットを検索（環境：{env}）',
      'hint.needQuery.description': '環境の切り替えは @環境名/キーワード。認証済み：{envs}',
      'hint.noMatch': '「{keyword}」に一致するデータセットやダッシュボードは {env} にありません',
      'hint.noMatch.description': '別のキーワードか、@環境名/キーワードで環境を切り替えてください',
      'hint.noEnvironment': 'guancli に認証済みの BI 環境がありません',
      'hint.noEnvironment.description': 'guancli auth login を実行してから @ を使ってください',
      'hint.noCli': 'guancli が見つからないか実行できません',
      'hint.noCli.description': 'guancli がインストールされ実行可能か確認してください',
      'hint.noGateway': 'Guandata プラグインが無効のためアセットを検索できません',
      'hint.noGateway.description': '@guandata/dsh-guancli をインストールしてください',
      'hint.error': 'Guandata アセットの検索に失敗しました',
      'hint.error.description': '後で再試行してください。続く場合は BI 接続を確認してください',
      'hint.unknownEnvironment': '環境 {env} は guancli で認証されていません',
      'hint.restart': 'Guandata プラグインは DSH Desktop の再起動後に有効になります',
      'hint.restart.description': '新しい Host モジュールは再起動時に読み込まれます。再起動して再読み込みしてください',
      'asset.open': '{name} をサイドバーで開く',
      'asset.openFailed': '開けませんでした：{reason}',
    }
    const es = {
      'section.datasets': 'Conjuntos de datos de Guandata',
      'section.pages': 'Paneles de Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Escriba una palabra clave para buscar activos (entorno: {env})',
      'hint.needQuery.description': 'Cambie de entorno con @entorno/palabra; autenticados: {envs}',
      'hint.noMatch': 'Ningún conjunto de datos o panel coincide con "{keyword}" en {env}',
      'hint.noMatch.description': 'Pruebe otra palabra o entorno: @entorno/palabra',
      'hint.noEnvironment': 'guancli no tiene ningún entorno BI autenticado',
      'hint.noEnvironment.description': 'Ejecute guancli auth login y vuelva a usar @',
      'hint.noCli': 'guancli no está instalado o no se puede ejecutar',
      'hint.noCli.description': 'Compruebe que guancli esté instalado y disponible',
      'hint.noGateway': 'El plugin de Guandata está desactivado; no se pueden buscar activos',
      'hint.noGateway.description': 'Instale @guandata/dsh-guancli para reutilizar su descubrimiento',
      'hint.error': 'Falló la búsqueda de activos de Guandata',
      'hint.error.description': 'Reintente más tarde; si persiste, revise la conexión BI',
      'hint.unknownEnvironment': 'El entorno {env} no está autenticado en guancli',
      'hint.restart': 'El plugin de Guandata requiere reiniciar DSH Desktop',
      'hint.restart.description': 'El nuevo módulo Host solo se carga al reiniciar; reinicie, recargue y reintente',
      'asset.open': 'Abrir {name} en la barra lateral',
      'asset.openFailed': 'Error al abrir: {reason}',
    }
    const fr = {
      'section.datasets': 'Jeux de données Guandata',
      'section.pages': 'Tableaux de bord Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Saisissez un mot-clé pour chercher des actifs (environnement : {env})',
      'hint.needQuery.description': "Changez d'environnement avec @env/mot-clé ; authentifiés : {envs}",
      'hint.noMatch': 'Aucun jeu de données ni tableau de bord ne correspond à « {keyword} » dans {env}',
      'hint.noMatch.description': 'Essayez un autre mot-clé ou environnement : @env/mot-clé',
      'hint.noEnvironment': "guancli n'a aucun environnement BI authentifié",
      'hint.noEnvironment.description': 'Lancez guancli auth login puis réutilisez @',
      'hint.noCli': 'guancli est absent ou non exécutable',
      'hint.noCli.description': 'Vérifiez que guancli est installé et exécutable',
      'hint.noGateway': 'Le plugin Guandata est désactivé ; recherche impossible',
      'hint.noGateway.description': 'Installez @guandata/dsh-guancli pour réutiliser sa découverte',
      'hint.error': 'Échec de la recherche d’actifs Guandata',
      'hint.error.description': 'Réessayez plus tard ; vérifiez la connexion BI si cela persiste',
      'hint.unknownEnvironment': "L'environnement {env} n'est pas authentifié dans guancli",
      'hint.restart': 'Le plugin Guandata nécessite un redémarrage de DSH Desktop',
      'hint.restart.description': 'Le nouveau module Host ne se charge qu’au redémarrage ; redémarrez, rechargez puis réessayez',
      'asset.open': 'Ouvrir {name} dans la barre latérale',
      'asset.openFailed': 'Échec de l’ouverture : {reason}',
    }
    const de = {
      'section.datasets': 'Guandata-Datensätze',
      'section.pages': 'Guandata-Dashboards',
      'section.status': 'Guandata',
      'hint.needQuery': 'Suchbegriff eingeben, um Guandata-Assets zu finden (Umgebung: {env})',
      'hint.needQuery.description': 'Umgebung wechseln mit @umgebung/suchbegriff; authentifiziert: {envs}',
      'hint.noMatch': 'Kein Datensatz und kein Dashboard passt zu „{keyword}“ in {env}',
      'hint.noMatch.description': 'Anderen Suchbegriff oder @umgebung/suchbegriff versuchen',
      'hint.noEnvironment': 'guancli hat keine authentifizierte BI-Umgebung',
      'hint.noEnvironment.description': 'Führen Sie guancli auth login aus und nutzen Sie @ erneut',
      'hint.noCli': 'guancli fehlt oder ist nicht ausführbar',
      'hint.noCli.description': 'Prüfen Sie, ob guancli installiert und ausführbar ist',
      'hint.noGateway': 'Das Guandata-Plugin ist deaktiviert; Assets nicht durchsuchbar',
      'hint.noGateway.description': 'Installieren Sie @guandata/dsh-guancli',
      'hint.error': 'Guandata-Assetsuche fehlgeschlagen',
      'hint.error.description': 'Später erneut versuchen; sonst BI-Verbindung prüfen',
      'hint.unknownEnvironment': 'Umgebung {env} ist in guancli nicht authentifiziert',
      'hint.restart': 'Das Guandata-Plugin benötigt einen DSH-Desktop-Neustart',
      'hint.restart.description': 'Das neue Host-Modul lädt erst nach dem Neustart; neu starten, Seite neu laden, erneut versuchen',
      'asset.open': '{name} in der Seitenleiste öffnen',
      'asset.openFailed': 'Öffnen fehlgeschlagen: {reason}',
    }
    const ru = {
      'section.datasets': 'Наборы данных Guandata',
      'section.pages': 'Панели Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Введите запрос для поиска активов (среда: {env})',
      'hint.needQuery.description': 'Смена среды: @среда/запрос; авторизованы: {envs}',
      'hint.noMatch': 'В среде {env} нет набора данных или панели по запросу «{keyword}»',
      'hint.noMatch.description': 'Попробуйте другой запрос или @среда/запрос',
      'hint.noEnvironment': 'В guancli нет авторизованной среды BI',
      'hint.noEnvironment.description': 'Выполните guancli auth login и снова используйте @',
      'hint.noCli': 'guancli не найден или не запускается',
      'hint.noCli.description': 'Проверьте, что guancli установлен и доступен',
      'hint.noGateway': 'Плагин Guandata отключён, поиск активов недоступен',
      'hint.noGateway.description': 'Установите @guandata/dsh-guancli',
      'hint.error': 'Не удалось выполнить поиск активов Guandata',
      'hint.error.description': 'Повторите позже; проверьте подключение к BI',
      'hint.unknownEnvironment': 'Среда {env} не авторизована в guancli',
      'hint.restart': 'Плагину Guandata нужен перезапуск DSH Desktop',
      'hint.restart.description': 'Новый модуль Host загружается только после перезапуска; перезапустите и повторите',
      'asset.open': 'Открыть «{name}» в боковой панели',
      'asset.openFailed': 'Не удалось открыть: {reason}',
    }
    const pt = {
      'section.datasets': 'Conjuntos de dados Guandata',
      'section.pages': 'Painéis Guandata',
      'section.status': 'Guandata',
      'hint.needQuery': 'Digite uma palavra-chave para buscar ativos (ambiente: {env})',
      'hint.needQuery.description': 'Troque de ambiente com @ambiente/palavra; autenticados: {envs}',
      'hint.noMatch': 'Nenhum conjunto de dados ou painel corresponde a "{keyword}" em {env}',
      'hint.noMatch.description': 'Tente outra palavra ou ambiente: @ambiente/palavra',
      'hint.noEnvironment': 'O guancli não tem ambiente BI autenticado',
      'hint.noEnvironment.description': 'Execute guancli auth login e use @ novamente',
      'hint.noCli': 'guancli ausente ou não executável',
      'hint.noCli.description': 'Verifique se o guancli está instalado e disponível',
      'hint.noGateway': 'O plugin Guandata está desativado; busca indisponível',
      'hint.noGateway.description': 'Instale @guandata/dsh-guancli',
      'hint.error': 'Falha na busca de ativos Guandata',
      'hint.error.description': 'Tente mais tarde; verifique a conexão BI',
      'hint.unknownEnvironment': 'O ambiente {env} não está autenticado no guancli',
      'hint.restart': 'O plugin Guandata requer reiniciar o DSH Desktop',
      'hint.restart.description': 'O novo módulo Host só carrega após reiniciar; reinicie, recarregue e tente de novo',
      'asset.open': 'Abrir {name} na barra lateral',
      'asset.openFailed': 'Falha ao abrir: {reason}',
    }

    /**
     * Strip characters that would break the Markdown mention form or the draft
     * span validation. Must agree with the Host-side sanitizer.
     * @param value - raw asset name.
     * @returns a single-line label.
     */
    function sanitizeLabel(value) {
      const collapsed = String(value == null ? '' : value)
        .replace(/[[\]()\n\r\t]/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
      return Array.from(collapsed).slice(0, 60).join('').trim()
    }

    /**
     * Call the Host mention RPC.
     * @param action - action name.
     * @param input - action input.
     * @param signal - candidate-fetch cancellation.
     * @returns `{ data }`, `{ error }`, or `{ aborted: true }`.
     */
    async function rpc(action, input, signal) {
      let response
      try {
        response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, input }),
          signal,
        })
      } catch (error) {
        if (error && error.name === 'AbortError') return { aborted: true }
        console.warn('[guancli-mentions] rpc unavailable:', error)
        return { error: 'unreachable' }
      }
      let body
      try {
        body = await response.json()
      } catch {
        return { error: 'invalid response' }
      }
      if (!body || body.ok !== true) {
        console.warn('[guancli-mentions] rpc failed:', body && body.error)
        return { error: (body && body.error && body.error.message) || 'rpc failed' }
      }
      return { data: body.data }
    }

    /** Datasets icon: stacked rows, matching the BI dataset glyph. */
    function DatasetIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('ellipse', { cx: 12, cy: 6, rx: 7, ry: 3, key: 'top' }),
        h('path', { d: 'M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6', key: 'body' }),
        h('path', { d: 'M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6', key: 'base' }),
      )
    }

    /** Dashboard icon: a framed page with two cards. */
    function PageIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2, key: 'frame' }),
        h('path', { d: 'M7 9h6v4H7z', key: 'card-a' }),
        h('path', { d: 'M16 9v4', key: 'card-b' }),
        h('path', { d: 'M7 16h10', key: 'axis' }),
      )
    }

    /** Status icon: a plain information ring used by explain-me rows. */
    function HintIcon({ size = 14 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('circle', { cx: 12, cy: 12, r: 9, key: 'ring' }),
        h('path', { d: 'M12 11v5', key: 'stem' }),
        h('path', { d: 'M12 8h.01', key: 'dot' }),
      )
    }

    /** Cached result of the one-time Host capability probe. */
    let hostReady

    /** Lowest Host generation that serves environment-scoped candidates. */
    const MIN_HOST_VERSION = '0.2.0'

    /**
     * Compare dotted versions numerically: `version` >= `minimum`.
     * @param version - reported Host version.
     * @param minimum - lowest accepted version.
     * @returns whether the Host generation satisfies the floor.
     */
    function versionAtLeast(version, minimum) {
      const parse = (text) => String(text).split('.').map((part) => {
        const numeric = Number.parseInt(part, 10)
        return Number.isFinite(numeric) ? numeric : 0
      })
      const left = parse(version)
      const right = parse(minimum)
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const a = left[index] ?? 0
        const b = right[index] ?? 0
        if (a !== b) return a > b
      }
      return true
    }

    /**
     * The Host half must be the environment-scoped generation; a replaced
     * package keeps serving the previous module until the app restarts.
     * @returns whether the Host answered with an accepted generation.
     */
    async function ensureHost() {
      if (hostReady !== undefined) return hostReady
      const result = await rpc('health', {})
      // A probe that never reached the host says nothing about its generation;
      // the real call reports that failure with its own row.
      if (result.data === undefined) return true
      hostReady = typeof result.data.version === 'string' && versionAtLeast(result.data.version, MIN_HOST_VERSION)
      return hostReady
    }

    /**
     * Build the registered `@` source.
     * @param scope - context exposing `inputTriggers` and `locale`.
     * @returns one input-trigger source.
     */
    function createSource(scope) {
      const t = scope.locale.bind(NS)

      /**
       * Translate then substitute `{name}` placeholders.
       * @param key - locale key.
       * @param values - placeholder values.
       * @returns the rendered text.
       */
      function text(key, values = {}) {
        return String(t(key)).replace(/\{(\w+)\}/gu, (whole, name) => (
          Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole
        ))
      }

      /**
       * One explain-me row: picking it inserts nothing, it only explains why the
       * group is empty. Its presence also proves the Client half is loaded.
       * @param name - headline text.
       * @param description - what the user should do.
       * @returns a non-insertable candidate.
       */
      function hintRow(name, description) {
        return {
          name,
          ...(description === undefined ? {} : { description }),
          icon: HintIcon,
          section: t('section.status'),
          value: JSON.stringify({ kind: 'hint' }),
        }
      }

      /**
       * Explain one empty state.
       * @param data - the host candidate payload.
       * @param keyword - keyword the user typed.
       * @returns the row.
       */
      function explain(data, keyword) {
        const env = data.env || '—'
        const envs = Array.isArray(data.environments) && data.environments.length > 0
          ? data.environments.join(' / ')
          : '—'
        switch (data.state) {
          case 'need-query':
            return hintRow(text('hint.needQuery', { env }), text('hint.needQuery.description', { envs }))
          case 'no-match':
            return hintRow(text('hint.noMatch', { keyword, env }), t('hint.noMatch.description'))
          case 'unknown-environment':
            return hintRow(text('hint.unknownEnvironment', { env }), text('hint.needQuery.description', { envs }))
          case 'no-environment':
            return hintRow(t('hint.noEnvironment'), t('hint.noEnvironment.description'))
          case 'no-cli':
            return hintRow(t('hint.noCli'), t('hint.noCli.description'))
          case 'no-gateway':
            return hintRow(t('hint.noGateway'), t('hint.noGateway.description'))
          default:
            return hintRow(t('hint.error'), t('hint.error.description'))
        }
      }

      return {
        trigger: '@',
        name: SOURCE,
        order: -10,
        showGroupTitle: false,
        /**
         * The composer serializes every picked chip through its owning source's
         * codec before submit. Without one, sending fails with
         * `slash: no serializer for reference source "guancli"`.
         * `ref` is already the canonical mention the Host parses, so the model
         * form is the ref itself.
         */
        codec: {
          clipboardText: (ref) => ref,
          serialize: (ref) => Promise.resolve(ref),
        },
        async candidates(session, request) {
          if (request.quoted === true) return []
          const sessionId = String(session && session.sessionId ? session.sessionId : '')
          if (sessionId === '') return []
          if (!(await ensureHost())) return [hintRow(t('hint.restart'), t('hint.restart.description'))]
          const keyword = String(request.query || '')
          const result = await rpc('candidates', { sessionId, query: keyword }, request.signal)
          if (result.aborted) return []
          if (result.error !== undefined || result.data === undefined) {
            return [hintRow(t('hint.error'), t('hint.error.description'))]
          }
          const data = result.data
          const items = Array.isArray(data.items) ? data.items : []
          if (items.length === 0) return [explain(data, keyword)]
          return items.map((item) => {
            const label = sanitizeLabel(item.name) || String(item.id)
            const section = item.type === 'page' ? t('section.pages') : t('section.datasets')
            return {
              name: label,
              ...(item.path ? { description: `${item.env} · ${item.path}` } : { description: item.env }),
              icon: item.type === 'page' ? PageIcon : DatasetIcon,
              section,
              value: JSON.stringify({ type: item.type, id: String(item.id), name: label, env: item.env }),
            }
          })
        },
        onPick({ candidate }) {
          let value
          try {
            value = JSON.parse(candidate.value)
          } catch {
            return undefined
          }
          if (!value || value.kind === 'hint') return undefined
          if ((value.type !== 'dataset' && value.type !== 'page') || !value.id || !value.env) return undefined
          const label = sanitizeLabel(value.name) || String(value.id)
          const mention = `@[${label}](dsh-guancli:${value.type}:${value.env}:${value.id})`
          return {
            insert: {
              source: SOURCE,
              ref: mention,
              label,
              clipboardText: mention,
            },
          }
        },
      }
    }

    /**
     * user-text rule: turn a sent asset mention into a clickable node.
     * The wire form carries env and id; the durable message keeps it verbatim.
     */
    const assetMentionRule = {
      id: 'guancli-asset',
      order: 10,
      match(text, from) {
        const wire = /@\[([^\]\n]{1,200})\]\(dsh-guancli:(page|dataset):([^:\s)]+):([^)\s]+)\)/gu
        let start = text.indexOf('@', from)
        while (start >= 0) {
          wire.lastIndex = start
          const found = wire.exec(text)
          if (found !== null && found.index === start) {
            return {
              id: 'guancli-asset',
              start,
              end: start + found[0].length,
              data: {
                label: sanitizeLabel(found[1]) || found[4],
                type: found[2],
                env: found[3],
                id: found[4],
              },
            }
          }
          start = text.indexOf('@', start + 1)
        }
        return undefined
      },
    }

    /**
     * Clickable asset chip rendered inside sent user messages.
     * Opens the BI page in the sidebar browser.
     */
    function AssetLink({ node, openAsset, t }) {
      const data = node.data || {}
      const label = data.label || data.id || '观远资产'
      const translate = typeof t === 'function' ? t : (key) => key
      return h('button', {
        type: 'button',
        className: 'guancli-asset-link',
        title: translate('asset.open', { name: label }),
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          border: 'none',
          padding: '0 2px',
          background: 'transparent',
          color: 'var(--dsw-alias-state-business-primary, #0F6FE0)',
          font: 'inherit',
          cursor: 'pointer',
          borderBottom: '1px dashed currentColor',
        },
        onClick: () => (typeof openAsset === 'function' ? openAsset(data) : undefined),
      },
        h('span', { 'aria-hidden': true }, data.type === 'page' ? '📊' : '🗂️'),
        h('span', null, label),
      )
    }

    /** Console prefixes the probe logs with (mirror src/probe.js). */
    const PROBE_LOG_PREFIX = '__GUANCLI_DASHBOARD_CONTEXT__'
    const DOM_PROBE_PREFIX = '__GUANCLI_DOM_PROBE__'

    /**
     * Parse one console line from the injected probe (browser copy of the
     * node-side parser, kept dependency-free for the module bundle).
     * @param text - console message text.
     * @returns the context object or null.
     */
    function parseProbeOutputText(text) {
      const raw = String(text ?? '')
      if (!raw.startsWith(PROBE_LOG_PREFIX)) return null
      try {
        const value = JSON.parse(raw.slice(PROBE_LOG_PREFIX.length))
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
        if (!/^[a-z0-9]{24}$/i.test(String(value.pageId ?? ''))) return null
        return {
          pageId: String(value.pageId),
          pageName: String(value.pageName ?? ''),
          url: String(value.url ?? ''),
          selectors: Array.isArray(value.selectors) ? value.selectors : [],
          focusedCardId: String(value.focusedCardId ?? ''),
          capturedAt: Number(value.capturedAt ?? 0),
        }
      } catch (_error) {
        return null
      }
    }

    /**
     * Match a URL's host against authenticated environment URLs.
     * @param rawUrl - webview URL.
     * @param environments - environment entries with urls.
     * @returns the environment name or null.
     */
    function matchEnvironmentName(rawUrl, environments) {
      let host = ''
      try {
        host = new URL(String(rawUrl ?? '')).hostname.toLowerCase()
      } catch (_error) {
        return null
      }
      if (host === '') return null
      for (const environment of environments ?? []) {
        try {
          const envHost = new URL(String(environment.url ?? '')).hostname.toLowerCase()
          if (envHost !== '' && (host === envHost || host.endsWith(`.${envHost}`))) {
            return String(environment.name)
          }
        } catch (_error) {
          // Skip malformed entries.
        }
      }
      return null
    }

    /** Inlined dashboard probe (generated from src/probe.js — do not edit by hand; run scripts/sync-probe.mjs). */
    const PROBE_SCRIPT = "(() => {\n  const PROBE_VERSION = '0.5.8'\n  const existing = globalThis.__guancliDashboardProbe\n  if (existing && existing.version === PROBE_VERSION) return 'already-installed'\n  if (existing && typeof existing.stop === 'function') existing.stop()\n\n  const ID_PATTERN = /^[a-z0-9]{24}$/i\n  const ROOT_SELECTOR = '[data-selector-id],[data-cd-id],[data-card-id],[data-component-id]'\n  const MAX_SELECTORS = 30\n  const MAX_VALUES = 50\n  const DOM_PROBE_PREFIX = '__GUANCLI_DOM_PROBE__'\n  let focusedCardId = ''\n  let runtimeContext = null\n  let timer = null\n  let lastPublished = ''\n\n  function idFrom(element) {\n    if (!element) return ''\n    for (const name of ['data-selector-id', 'data-cd-id', 'data-card-id', 'data-component-id']) {\n      const value = element.getAttribute?.(name) || ''\n      if (ID_PATTERN.test(value)) return value\n    }\n    return ID_PATTERN.test(element.id || '') ? element.id : ''\n  }\n\n  function pageId() {\n    try {\n      const url = new URL(location.href)\n      for (const key of ['pageId', 'page_id', 'pgId', 'pg_id']) {\n        const value = url.searchParams.get(key) || new URLSearchParams(url.hash.split('?')[1] || '').get(key)\n        if (ID_PATTERN.test(value || '')) return value\n      }\n      const routeMatch = location.href.match(/(?:page|dashboard|analysis)[/=:]([a-z0-9]{24})(?:[/?#&]|$)/i)\n      if (routeMatch) return routeMatch[1]\n      for (const selector of ['[data-page-id]', '[data-pg-id]']) {\n        const node = document.querySelector(selector)\n        const value = node?.getAttribute(selector.includes('page') ? 'data-page-id' : 'data-pg-id') || ''\n        if (ID_PATTERN.test(value)) return value\n      }\n    } catch (_error) {}\n    return ''\n  }\n\n  function cleanText(value) {\n    return String(value || '').replace(/\\s+/g, ' ').trim().slice(0, 500)\n  }\n\n  function selectedValues(root) {\n    const values = []\n    const add = (value) => {\n      const normalized = cleanText(value)\n      if (!normalized || /^(全部|全选|请选择|搜索)$/i.test(normalized) || values.includes(normalized)) return\n      values.push(normalized)\n    }\n    for (const option of root.querySelectorAll('select option:checked')) add(option.value || option.textContent)\n    for (const input of root.querySelectorAll('input[type=\"checkbox\"]:checked,input[type=\"radio\"]:checked')) add(input.value || input.getAttribute('aria-label'))\n    for (const input of root.querySelectorAll('input:not([type=\"checkbox\"]):not([type=\"radio\"])')) if (input.value) add(input.value)\n    for (const node of root.querySelectorAll('[aria-selected=\"true\"],.ant-select-selection-item')) add(node.getAttribute('title') || node.textContent)\n    return values.slice(0, MAX_VALUES)\n  }\n\n  function domSelectors() {\n    const selections = []\n    const seen = new Set()\n    for (const root of document.querySelectorAll(ROOT_SELECTOR)) {\n      const selectorId = idFrom(root)\n      if (!selectorId || seen.has(selectorId)) continue\n      const values = selectedValues(root)\n      if (!values.length) continue\n      seen.add(selectorId)\n      selections.push({ selectorId, values, displayValues: values, operator: values.length > 1 ? 'IN' : 'EQ', origin: 'dom' })\n      if (selections.length >= MAX_SELECTORS) break\n    }\n    return selections\n  }\n\n  /**\n   * Wide-pass capture for BI builds whose filter widgets carry no\n   * data-* identity: aggregate selected pills per combobox, plus valued\n   * inputs and checked options. Fingerprinted by container class+label,\n   * origin-tagged 'dom-wide'; noise is accepted over silence — the merge\n   * step whitelists by field name anyway.\n   */\n  function wideSelectors() {\n    const out = []\n    const seen = new Set()\n    const push = (fingerprint, values, extra) => {\n      const cleaned = values.map(cleanText).filter((value) => value !== '')\n      // Unlabeled widgets are canvas layout controls (e.g. '自动铺满(70%)'),\n      // not filters — drop them; labeled ones are real selectors.\n      if (cleaned.length === 0 || seen.has(fingerprint)) return\n      if (extra?.name === undefined || extra.name === '') return\n      seen.add(fingerprint)\n      out.push({\n        selectorId: 'wide-' + String(out.length + 1),\n        values: cleaned.slice(0, MAX_VALUES),\n        displayValues: cleaned.slice(0, MAX_VALUES),\n        operator: cleaned.length > 1 ? 'IN' : 'EQ',\n        origin: 'dom-wide',\n        ...extra,\n      })\n    }\n    for (const box of document.querySelectorAll('[role=\"combobox\"],.ant-select,[class*=\"Select\"],[class*=\"selector\"]')) {\n      const pills = [...box.querySelectorAll('.ant-select-selection-item,[aria-selected=\"true\"]')]\n        .map((el) => cleanText(el.getAttribute('title') || el.textContent))\n        .filter((value) => value !== '' && !/^(全部|全选|请选择|搜索)$/iu.test(value))\n      if (pills.length === 0) continue\n      const label = cleanText(\n        box.closest('[class*=\"filter\"],[class*=\"Filter\"],[class*=\"selector\"],[data-selector-id]')?.querySelector('[class*=\"title\"],[class*=\"label\"],label')?.textContent\n        || box.getAttribute('aria-label') || '',\n      ).slice(0, 40)\n      push('box:' + String(box.className || '').slice(0, 60) + ':' + label, pills, { name: label || undefined })\n    }\n    for (const input of document.querySelectorAll('input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"hidden\"])')) {\n      const value = cleanText(input.value)\n      if (value === '') continue\n      const label = cleanText(input.getAttribute('placeholder') || input.getAttribute('aria-label') || input.name || '').slice(0, 40)\n      push('input:' + String(input.name || input.id || input.className || '').slice(0, 60) + ':' + label, [value], { name: label || undefined })\n    }\n    for (const select of document.querySelectorAll('select')) {\n      const values = [...select.selectedOptions].map((option) => cleanText(option.value || option.textContent)).filter((value) => value !== '')\n      if (values.length === 0) continue\n      push('select:' + String(select.name || select.id || '').slice(0, 60), values, { name: cleanText(select.name || '').slice(0, 40) || undefined })\n    }\n    return out.slice(0, MAX_SELECTORS)\n  }\n\n  /**\n   * Pick the selector list: the runtime broadcast wins only when it\n   * actually carries entries, then the identified-widget DOM pass, then\n   * the wide pass. Entries are origin-tagged. 'precise' is false when the\n   * wide pass carried the result — that is exactly when a DOM recon\n   * report is most needed.\n   */\n  function resolveSelectors() {\n    const runtime = runtimeContext && typeof runtimeContext === 'object' ? runtimeContext : {}\n    if (Array.isArray(runtime.selectors) && runtime.selectors.length > 0) {\n      return { list: runtime.selectors.slice(0, MAX_SELECTORS).map((selector) => ({ origin: 'runtime', ...selector })), precise: true }\n    }\n    const dom = domSelectors()\n    if (dom.length > 0) return { list: dom, precise: true }\n    return { list: wideSelectors(), precise: false }\n  }\n\n  function safeUrl() {\n    try {\n      const url = new URL(location.href)\n      const hashPath = url.hash ? url.hash.split('?')[0] : ''\n      return url.origin + url.pathname + hashPath\n    } catch (_error) {\n      return location.href\n    }\n  }\n\n  function snapshot() {\n    const runtime = runtimeContext && typeof runtimeContext === 'object' ? runtimeContext : {}\n    const currentPageId = String(runtime.pageId || pageId())\n    const resolved = resolveSelectors()\n    return {\n      pageId: currentPageId,\n      pageName: cleanText(runtime.pageName || document.querySelector('[data-page-name],h1')?.textContent || document.title),\n      url: safeUrl(),\n      selectors: resolved.list,\n      selectorPrecise: resolved.precise,\n      focusedCardId: String(runtime.focusedCardId || focusedCardId || ''),\n      capturedAt: Date.now(),\n    }\n  }\n\n  /** Last DOM recon emission, throttled to one per 30 seconds. */\n  let lastDomProbeAt = 0\n\n  /**\n   * Recon pass over unknown BI DOM: input/select inventory, data-* attribute\n   * names, and candidate listbox/filter containers. Sent only while the\n   * selector list stays empty so the plugin author can adapt the real DOM.\n   */\n  function domProbe() {\n    const inputs = []\n    for (const el of document.querySelectorAll('input, select, textarea')) {\n      inputs.push({\n        tag: el.tagName.toLowerCase(),\n        type: el.type || '',\n        name: el.getAttribute('name') || '',\n        placeholder: (el.getAttribute('placeholder') || '').slice(0, 60),\n        value: String(el.value ?? '').slice(0, 60),\n        cls: String(el.className || '').slice(0, 80),\n        label: String(el.getAttribute('aria-label') || (el.closest('label')?.textContent || '')).slice(0, 60),\n        data: Object.keys(el.dataset || {}).slice(0, 8),\n      })\n      if (inputs.length >= 40) break\n    }\n    const dataNames = new Set()\n    for (const el of document.querySelectorAll('[data-selector-id],[data-cd-id],[data-card-id],[data-component-id],[data-page-id]')) {\n      for (const attr of el.attributes) if (attr.name.startsWith('data-')) dataNames.add(attr.name)\n    }\n    const containers = []\n    for (const el of document.querySelectorAll('[role=\"listbox\"],[role=\"combobox\"],[class*=\"select\"],[class*=\"selector\"],[class*=\"filter\"]')) {\n      containers.push({\n        cls: String(el.className || '').slice(0, 80),\n        text: cleanText(el.textContent).slice(0, 80),\n        role: el.getAttribute('role') || '',\n      })\n      if (containers.length >= 25) break\n    }\n    return {\n      kind: 'dom-probe',\n      url: safeUrl(),\n      title: cleanText(document.title),\n      dataNames: [...dataNames],\n      inputs,\n      containers,\n    }\n  }\n\n  function publish() {\n    const value = snapshot()\n    if (!ID_PATTERN.test(value.pageId)) return\n    const serialized = JSON.stringify(value)\n    if (serialized !== lastPublished) {\n      lastPublished = serialized\n      console.log('__GUANCLI_DASHBOARD_CONTEXT__' + serialized)\n    }\n    if (value.selectorPrecise !== true && Date.now() - lastDomProbeAt > 30_000) {\n      lastDomProbeAt = Date.now()\n      console.log('__GUANCLI_DOM_PROBE__' + JSON.stringify(domProbe()).slice(0, 16 * 1024))\n    }\n  }\n\n  function schedule() {\n    clearTimeout(timer)\n    timer = setTimeout(publish, 600)\n  }\n\n  const onClick = (event) => {\n    const root = event.target?.closest?.(ROOT_SELECTOR)\n    const id = idFrom(root)\n    if (id) focusedCardId = id\n    schedule()\n  }\n  const onMessage = (event) => {\n    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'GUANDATA_DASHBOARD_CONTEXT') return\n    runtimeContext = event.data.context || null\n    schedule()\n  }\n  document.addEventListener('click', onClick, true)\n  document.addEventListener('change', schedule, true)\n  window.addEventListener('popstate', schedule)\n  window.addEventListener('hashchange', schedule)\n  window.addEventListener('message', onMessage)\n  globalThis.__guancliDashboardProbe = {\n    version: PROBE_VERSION,\n    stop: () => {\n      clearTimeout(timer)\n      document.removeEventListener('click', onClick, true)\n      document.removeEventListener('change', schedule, true)\n      window.removeEventListener('popstate', schedule)\n      window.removeEventListener('hashchange', schedule)\n      window.removeEventListener('message', onMessage)\n    },\n  }\n  schedule()\n  return 'installed'\n})()";
// __PROBE_SCRIPT_INLINED__

    /**
     * Watch the sidebar webview: inject the dashboard probe into Guandata BI
     * pages and forward captured contexts to the Host. All failures are
     * swallowed — the watcher must never break the page.
     * @param ctx - client root context.
     */
    function startDashboardProbe(ctx) {
      let probeScript = ''
      let environments = []
      let environmentsAt = 0
      let setupPromise = null
      let lastPublished = ''
      const attached = new WeakSet()

      /** Fetch authenticated environments once, cached. The probe script
       * itself is inlined below — probe iterations ship with the client
       * bundle and only need a page refresh, not a Host restart. */
      async function ensureSetup() {
        if (setupPromise !== null) return setupPromise
        setupPromise = (async () => {
          try {
            probeScript = PROBE_SCRIPT
            if (Date.now() - environmentsAt > 5 * 60 * 1000 || environments.length === 0) {
              const envResult = await rpc('environments', {})
              if (Array.isArray(envResult.data?.environments)) {
                environments = envResult.data.environments.filter((entry) => typeof entry?.url === 'string' && entry.url !== '')
                environmentsAt = Date.now()
              }
            }
          } catch (error) {
            console.warn('[guancli-mentions] probe setup failed:', error)
          } finally {
            setupPromise = null
          }
        })()
        return setupPromise
      }

      /** @param webview - an Electron <webview> element. @returns its current URL. */
      function webviewUrl(webview) {
        try {
          if (typeof webview.getURL === 'function') return webview.getURL()
          return String(webview.src || '')
        } catch (_error) {
          return ''
        }
      }

      /** Push one context snapshot to the Host, deduplicated by content. */
      async function publish(context) {
        const serialized = JSON.stringify(context)
        if (serialized === lastPublished) return
        lastPublished = serialized
        try {
          await rpc('context.publish', { context })
        } catch (error) {
          console.warn('[guancli-mentions] context publish failed:', error)
        }
      }

      /** Parse one console line and forward probe output or DOM recon. */
      function onConsoleMessage(event) {
        const text = String(event?.message ?? '')
        const context = parseProbeOutputText(text)
        if (context !== null) {
          publish(context)
          return
        }
        if (text.startsWith(DOM_PROBE_PREFIX)) {
          try {
            const report = JSON.parse(text.slice(DOM_PROBE_PREFIX.length))
            rpc('context.domProbe', { report }).catch((error) => {
              console.warn('[guancli-mentions] dom probe upload failed:', error)
            })
          } catch (_error) {
            // Malformed recon line; ignore.
          }
        }
      }

      /** Best-effort probe (re-)injection; the script self-guards duplicates. */
      async function inject(webview) {
        if (probeScript === '') return
        try {
          await webview.executeJavaScript(probeScript)
        } catch (error) {
          probeState.injectErrors.push(String(error?.message ?? error).slice(0, 200))
          if (probeState.injectErrors.length > 5) probeState.injectErrors.shift()
        }
      }

      /** One reload attempt per navigation, for the flaky first-load failure. */
      const retried = new WeakSet()

      /**
       * Self-heal the recurring first-load failure: the Electron error page
       * "文件不存在" (-6) on BI pages always recovers on manual reload, so
       * retry once automatically after a short settle delay.
       */
      function onFailLoad(webview) {
        return (event) => {
          try {
            if (event?.isMainFrame !== true) return
            if (Number(event?.errorCode) !== -6) return
            const url = webviewUrl(webview)
            if (matchEnvironmentName(url, environments) === null) return
            if (retried.has(webview)) return
            retried.add(webview)
            setTimeout(() => {
              try {
                if (typeof webview.reload === 'function') webview.reload()
              } catch (_error) {}
            }, 800)
          } catch (_error) {}
        }
      }

      /** Wire listeners once per webview element, then inject. */
      async function attach(webview) {
        if (attached.has(webview)) return
        attached.add(webview)
        webview.addEventListener('console-message', onConsoleMessage)
        webview.addEventListener('did-navigate', () => { inject(webview) })
        webview.addEventListener('did-navigate-in-page', () => { inject(webview) })
        webview.addEventListener('dom-ready', () => { inject(webview) })
        webview.addEventListener('did-fail-load', onFailLoad(webview))
        await inject(webview)
      }

      /** Last sweep outcome, self-reported through the recon channel. */
      const probeState = { at: 0, probeScriptChars: 0, environments: 0, webviews: 0, biWebviews: 0, attached: 0, injectErrors: [] }

      /** Upload the watcher state so the debug channel shows where the pipeline stopped. */
      async function reportState() {
        try {
          await rpc('context.domProbe', { report: { kind: 'probe-state', ...probeState } })
        } catch (_error) {
          // Diagnostics are best-effort.
        }
      }

      /** One sweep: find BI webviews and attach the probe. */
      async function scan() {
        try {
          await ensureSetup()
          probeState.at = Date.now()
          probeState.probeScriptChars = probeScript.length
          probeState.environments = environments.length
          if (probeScript === '' || environments.length === 0) {
            await reportState()
            return
          }
          const elements = document.querySelectorAll('webview')
          probeState.webviews = elements.length
          probeState.biWebviews = 0
          probeState.attached = 0
          for (const webview of elements) {
            const env = matchEnvironmentName(webviewUrl(webview), environments)
            if (env === null) continue
            probeState.biWebviews += 1
            await attach(webview)
            if (attached.has(webview)) probeState.attached += 1
          }
          await reportState()
        } catch (error) {
          probeState.injectErrors.push(String(error?.message ?? error).slice(0, 200))
          if (probeState.injectErrors.length > 5) probeState.injectErrors.shift()
          await reportState()
        }
      }

      const interval = setInterval(scan, 2000)
      scan()
      return () => {
        clearInterval(interval)
      }
    }

    return {
      inject: ['locale'],
      apply(ctx) {
        ctx.effect(
          () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
          'guancli-mentions: dictionaries',
        )
        ctx.inject(['inputTriggers', 'locale'], (scope) => {
          scope.effect(
            () => scope.inputTriggers.registerSource(createSource(scope)),
            'guancli-mentions: @ source',
          )
        })

        /** Resolve the BI URL and reveal it in the sidebar browser. */
        async function openAsset(data) {
          try {
            const result = await rpc('pageUrl', {
              profile: String(data.env || ''),
              assetType: data.type === 'dataset' ? 'dataset' : 'page',
              assetId: String(data.id || ''),
            })
            const url = result.data && result.data.url
            if (typeof url !== 'string' || url === '') {
              console.warn('[guancli-mentions] pageUrl returned no url')
              return
            }
            const sidebarRight = ctx.get('sidebarRight')
            if (sidebarRight === undefined || typeof sidebarRight.openTab !== 'function') {
              console.warn('[guancli-mentions] sidebarRight unavailable')
              return
            }
            sidebarRight.openTab('browser', { params: { url } })
          } catch (error) {
            console.warn('[guancli-mentions] open asset failed:', error)
          }
        }

        ctx.inject(['uiConversation', 'slots', 'locale'], (scope) => {
          const t = scope.locale.bind(NS)
          scope.uiConversation.userText.register(assetMentionRule)
          scope.effect(
            () => scope.slots.inject('conversation.user.text.node', () => scope.slots.register({
              name: 'conversation.user.text.node',
              key: 'guancli-asset',
              locale: NS,
              inject: () => ({ openAsset, t }),
            }, AssetLink)),
            'guancli-mentions: asset link node',
          )
        })

        ctx.effect(() => startDashboardProbe(ctx), 'guancli-mentions: dashboard probe')
      },
    }
  },
})
