# dsh-data-quality
- **1024 स्टोर चैनल**: एक बार `npm i -g dsh1024`, फिर `dsh1024 plugin --profile web add dsh-data-quality` ([deepseek1024.com](https://deepseek1024.com) इंस्टॉल रैंकिंग में गिना जाता है)।

**DeepSeek Harness के लिए निर्धारणात्मक (deterministic) डेटा प्रोफ़ाइलिंग, क्लीनिंग और सत्यापन।**

सारी गणना harness प्रक्रिया के अंदर शुद्ध TypeScript है — मॉडल कभी हिसाब नहीं करता। `ctx.dataQuality` क्षमता सीम (Service Definition / लोकल Provider / टूल Consumer) तीन मॉडल टूल और एक जमे हुए क्रॉस-प्लगिन उद्धरण सत्यापन अनुबंध को उजागर करती है।

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

## Compatibility

| घटक | संस्करण |
|---|---|
| DeepSeek Harness | `0.1.2-rc.1` (2026-09-02 को अनुकूलित): सत्र लिफ़ाफ़ा अपना ignorable फ़ील्ड केवल संग्रहीत-लॉग पठन संगतता के लिए रखता है - Session.append अभी भी इसे स्टैम्प नहीं कर सकता, इसलिए गेट व्यवहार अपरिवर्तित है। 2026-09-06 को dsh-v0.1.3-alpha.1 master checkout के विरुद्ध सत्यापित (पूर्ण गेट श्रृंखला + प्रोफ़ाइल इंस्टॉल स्मोक)। |
| Node.js | `^22.19.0 \|\| >=24.0.0` |
| पैकेज मैनेजर | `pnpm@11.7.0` |
| प्लेटफ़ॉर्म | Windows / macOS / Linux (केवल होस्ट प्लगिन) |

## What you get

- **`ctx.dataQuality` सेवा** — एक Cordis सेवा जिसे अन्य प्लगिन वैकल्पिक रूप से उपभोग कर सकते हैं (`inject = ['dataQuality']`)। टूल्स के पीछे की तीन डेटासेट क्रियाओं के अलावा, यह जमा हुआ `verifyCitations(request)` अनुबंध लागू करती है: दस्तावेज़ में उद्धृत संख्याएँ/स्ट्रिंग डेटासेट स्नैपशॉट से मेल खाती हैं या नहीं — सापेक्ष सहिष्णुता संख्यात्मक तुलना और `verified` / `mismatch` / `not-found` / `unverifiable` स्थितियों के साथ।
- **`data_profile` टूल** — डेटासेट प्रोफ़ाइलिंग: पंक्ति/स्तंभ गिनती, अनुमानित स्तंभ प्रकार (number/date/boolean/string/empty/mixed), अनुपस्थिति दर, अद्वितीय मान संख्या, संख्यात्मक वितरण (min/max/mean/median/p25/p75), IQR आउटलायर गिनती, मिश्रित-प्रकार संदेह टिप्पणियाँ, और पूरी तालिका की डुप्लिकेट पंक्ति गिनती। बड़ी फ़ाइलों के लिए वैकल्पिक निर्धारणात्मक व्यवस्थित प्रतिचयन।
- **`data_clean` टूल** — क्रमबद्ध घोषणात्मक क्लीनिंग नियम: `dedupe` (स्तंभ समूह से), `fill-missing` (constant/mean/median/forward), `coerce-type` (number/date/boolean; विफलताएँ गिनी जाती हैं और अनुपस्थित बन जाती हैं), `normalize-unit` (जैसे 万/亿 प्रत्यय को आधार इकाई में), `trim`, `map-values` (एनुम मैपिंग)। प्रति-नियम ऑडिट लॉग और सीमित पूर्वावलोकन लौटाता है; केवल `outputPath` दिए जाने पर साफ़ डेटासेट लिखता है और मूल फ़ाइल को कभी अधिलेखित नहीं करता।
- **`data_verify` टूल** — घोषणात्मक सत्यापन नियम: `not-null`, `unique`, `range`, `regex`, `enum`, `cross-column` (जैसे `startDate < endDate`), `freshness` (संदर्भ तिथि से N दिनों के भीतर तिथि स्तंभ)। प्रति-नियम pass/fail और सीमित असफल-पंक्ति साक्ष्य; समग्र असफलता सामान्य `passed: false` परिणाम है, टूल त्रुटि नहीं।
- **टिकाऊ रिपोर्ट** — हर प्रोफ़ाइल/क्लीन/सत्यापन/उद्धरण रन `data_quality` स्टोरेज डोमेन (JSON बैकएंड) में सहेजा जाता है, कुंजी = रन टाइमस्टैम्प + डेटासेट-पथ फ़िंगरप्रिंट; कुंजी टूल परिणामों में `reportKey` के रूप में लौटती है। क्लीन रिपोर्ट सीमित पूर्वावलोकन भी सहेजती हैं, इसलिए हर मॉडल-दृश्य परिणाम केवल `reportKey` से पुनर्निर्मित किया जा सकता है।
- **सत्र ईवेंट** — जिन होस्ट पर सुरक्षित रूप से संभव है, रन `data-quality/profile` / `data-quality/clean` / `data-quality/verify` ईवेंट जोड़ते हैं (जहाँ समर्थित हो वहाँ `ignorable` चिह्न सहित)। प्रकाशित `0.1.2-rc.1` लाइन पर (पहले की rc लाइनों की तरह) append जानबूझकर छोड़ा जाता है — स्टोरेज-डोमेन रिपोर्ट हमेशा टिकाऊ प्रति होती है (देखें «Known limitations»)।

## Quick start

### npm चैनल

```sh
dsh plugin --profile web add dsh-data-quality
```

### Tarball चैनल (बिल्ड अनुमति की ज़रूरत नहीं)

```sh
pnpm pack                                  # dsh-data-quality-<version>.tgz बनाता है
dsh plugin --profile web add ./dsh-data-quality-<version>.tgz
```

### Git चैनल

```sh
dsh plugin --profile web add github:YOUR_ORG/dsh-data-quality#<commit-sha>
```

पहला `add` असफल होगा क्योंकि pnpm पैकेज का `prepare` बिल्ड रोकता है; pnpm द्वारा छपी सटीक कुंजी को प्रोफ़ाइल की `pnpm-workspace.yaml` में कॉपी करके फिर चलाएँ:

```yaml
allowBuilds:
  'dsh-data-quality': true
```

इंस्टॉल के बाद प्रोफ़ाइल पुनः आरंभ करें (bundle पुनः आरंभ पर सक्रिय होते हैं)। फिर CSV वाले वर्कस्पेस में एजेंट से कहें:

> `holdings.csv` को प्रोफ़ाइल करें, फिर व्हाइटस्पेस छाँटकर, `fund_code` पर डुप्लिकेट हटाकर और `holding_value` कॉलम की 万/亿 इकाइयाँ सामान्य करके क्लीन करें; अंत में सत्यापित करें कि `fund_code` अद्वितीय और गैर-रिक्त है।

## Install & uninstall

```sh
dsh plugin --profile web add dsh-data-quality      # इंस्टॉल (npm) — या ऊपर के तरीके
dsh plugin --profile web remove dsh-data-quality   # अनइंस्टॉल
```

## Configuration

सभी कुंजियाँ वैकल्पिक हैं (डिफ़ॉल्ट दिखाए गए); अमान्य मान लोड समय पर ठोस रूप से असफल होते हैं। हर कुंजी `cordis.yml` से बदली जा सकती है (bundle में समान डिफ़ॉल्ट वाली `cordis.patch.yml` आती है)।

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | मास्टर स्विच; `false` कुछ भी माउंट नहीं करता। |
| `maxRows` | `200000` | प्रति लोड कठोर पंक्ति सीमा; बड़े इनपुट ठोस रूप से अस्वीकृत (टूल का `sample` पैरामीटर उपयोग करें)। |
| `maxFileSizeMB` | `64` | प्रति लोड कठोर फ़ाइल-आकार सीमा (MiB)। |
| `defaultTolerance` | `1e-9` | उद्धरण `tolerance` न दे तो संख्यात्मक तुलना की डिफ़ॉल्ट सापेक्ष सहिष्णुता। |
| `evidenceRowLimit` | `20` | एक परिणाम में असफल-पंक्ति साक्ष्य (verify) और पूर्वावलोकन पंक्तियों (clean) की सीमा। |
| `allowedExtensions` | `['.csv', '.tsv', '.json', '.jsonl']` | डेटासेट के रूप में स्वीकृत एक्सटेंशन। |
| `workspaceRoot` | `""` | SERVICE-स्तरीय कॉल (जैसे `verifyCitations`) के लिए निरपेक्ष रूट जिनके पास सत्र वर्कस्पेस नहीं है; रिक्त = harness प्रक्रिया का आरंभ निर्देशिका। टूल कॉल हमेशा सत्र वर्कस्पेस cwd उपयोग करती हैं। |
| `storeReports` | `true` | रन रिपोर्ट `data_quality` स्टोरेज डोमेन में सहेजें और `reportKey` लौटाएँ। |
| `scorecardWeights` | सभी 1 (बराबर) | स्कोरकार्ड के भारित कुल के लिए प्रति-आयाम भार (completeness/uniqueness/validity/consistency/timeliness/accuracy); हर भार एक गैर-ऋणात्मक संख्या होना चाहिए। |

## Tools & surfaces

### `data_profile({ path, sample?, industryPreset? })`

वर्कस्पेस डेटासेट प्रोफ़ाइल करता है। `path` वर्कस्पेस-सापेक्ष (`.csv`/`.tsv`/`.json`/`.jsonl`; JSON सपाट ऑब्जेक्ट की सरणी होनी चाहिए)। `sample` स्तंभ कार्ड के लिए हर `ceil(N/sample)`-वीं पंक्ति लेता है (निर्धारणात्मक; पंक्ति गिनती सटीक रहती है)। `industryPreset` (`retail`/`saas`/`fund`/`real-estate`/`e-commerce`/`healthcare`/`logistics`/`manufacturing`/`energy`) उस उद्योग के अपेक्षित स्तंभ भरता है ताकि स्कोरकार्ड `accuracy` आयाम निर्धारित हो सके; अज्ञात id तेज़ी से असफल होते हैं। संरचित रिपोर्ट लौटाता है; मानव-पठनीय प्रति-स्तंभ सारांश रेंडर करता है।

### `data_clean({ path, rules, outputPath?, dryRun? })`

`rules` को सरणी क्रम में लागू करता है; हर नियम पिछले का आउटपुट देखता है। नियम संदर्भ:

| नियम | अतिरिक्त फ़ील्ड | अर्थ |
|---|---|---|
| `dedupe` | `columns?` | कुंजी-स्तंभ संयोजन पिछली पंक्ति से डुप्लिकेट हो तो पंक्ति हटाएँ (पहली रखी जाती है; छोड़ने पर सभी स्तंभ)। |
| `fill-missing` | `column`, `strategy`, `value?` | अनुपस्थित भरें: `constant` (`value` चाहिए), `mean`/`median` (संख्यात्मक स्तंभ), `forward` (पिछला गैर-अनुपस्थित)। |
| `coerce-type` | `column`, `to` | `number`/`date` (ISO)/`boolean` में बदलें; विफलताएँ अनुपस्थित बनती हैं और गिनी जाती हैं। |
| `normalize-unit` | `column`, `factors` | इकाई प्रत्यय हटाकर गुणा करें (`{"万": 10000, "亿": 100000000}`); साधारण संख्याएँ भी बदलती हैं। |
| `trim` | `columns?` | स्ट्रिंग सेल की व्हाइटस्पेस छाँटें (छोड़ने पर सभी स्तंभ)। |
| `map-values` | `column`, `map`, `else?` | सटीक-मिलान मैपिंग; अनमैप्ड मान रहते हैं (`keep`, डिफ़ॉल्ट) या `missing` बनते हैं। |

मूल फ़ाइल **कभी** अधिलेखित नहीं होती। `outputPath` देने पर साफ़ डेटासेट वहाँ लिखा जाता है (वर्कस्पेस-सीमित, एक्सटेंशन से प्रारूप); बिना उसके रन केवल पूर्वावलोकन है। `dryRun: true` से कोई फ़ाइल नहीं लिखी जाती और कुछ भी सहेजा नहीं जाता — परिणाम प्रति-स्तंभ क्लीनिंग योजना और अपेक्षित `contract`/`diffPreview` लौटाता है। परिणाम में पूर्व-डिलीवरी `contract` सारांश भी रहता है, और एक `clean-diff` पहले/बाद प्रोफ़ाइल रिपोर्ट स्टोरेज डोमेन में सहेजी जाती है।

### `data_report({ key?, kind?, format? })`

स्टोरेज डोमेन से सहेजी गई रिपोर्टें वापस पढ़ता है। एक रिपोर्ट लाने के लिए `key` (पिछले रन का सटीक `reportKey`) दें, या उस प्रकार की हर रिपोर्ट कालक्रम से सूचीबद्ध करने के लिए `kind` (`profile`/`clean`/`clean-diff`/`verify`/`citations`) दें; `key`/`kind` में से ठीक एक आवश्यक है। गलत या गायब कुंजियाँ तेज़ी से असफल होती हैं। `format: html` (`key` के साथ) रिपोर्ट को self-contained ऑफ़लाइन HTML दस्तावेज़ में रेंडर करता है — इनलाइन CSS/JS, कोई बाहरी अनुरोध नहीं, DAMA छह-आयामी स्कोरकार्ड और प्रोफ़ाइल/क्लीनिंग सारांश तालिकाएँ (केवल profile/clean रिपोर्ट)।

### `data_verify({ path, rules, expectations? })`

सत्यापन नियम मूल्यांकन करता है। नियम संदर्भ:

| नियम | अतिरिक्त फ़ील्ड | अर्थ |
|---|---|---|
| `not-null` | `column` | अनुपस्थित सेल (null/रिक्त/केवल-व्हाइटस्पेस) असफल। |
| `unique` | `columns` | जिन पंक्तियों का कुंजी संयोजन दोहरता है वे सब असफल (अनुपस्थित भी भाग लेता है)। |
| `range` | `column`, `min?`, `max?` | अनुपस्थित/अपार्स योग्य सेल और समावेशी सीमा से बाहर मान असफल (कम से कम एक सीमा आवश्यक)। |
| `regex` | `column`, `pattern`, `flags?` | अनुपस्थित या मेल न खाने वाली सेल असफल (पूर्ण JS regex)। |
| `enum` | `column`, `values` | छँटा हुआ टेक्स्ट सूची में न हो तो असफल। |
| `cross-column` | `left`, `op`, `rightColumn?`, `value?` | प्रति-पंक्ति तुलना: दोनों पार्स हों तो संख्यात्मक, तिथियाँ एपोक से, स्ट्रिंग केवल `==`/`!=` (`rightColumn`/`value` में से ठीक एक)। |
| `freshness` | `column`, `maxAgeDays`, `asOf?` | `asOf` से `maxAgeDays` दिन पुरानी तिथियाँ असफल (डिफ़ॉल्ट: अभी); अपार्स योग्य/अनुपस्थित असफल। |

अनुपस्थित सेल उसे पढ़ने वाले हर नियम को असफल करती है। साक्ष्य प्रति-नियम `evidenceRowLimit` असफल पंक्तियों तक सीमित है।

`expectations` निर्धारणात्मक मीट्रिक्स को अपेक्षित मानों से मिलाता है: `rowCount`, `columnSum`, `columnMean`, `uniqueCount`, `nullCount` (हर एक में `column` सिवाय `rowCount`, साथ `expected` और वैकल्पिक सापेक्ष `tolerance` [0, 1] में)। हर अपेक्षा `passed` के साथ `actual`/`expected`/`tolerance` देती है; बेमेल सामान्य `passed: false` निर्णय है, कभी टूल त्रुटि नहीं। अमान्य मीट्रिक्स, गायब स्तंभ और सीमा से बाहर tolerance तेज़ी से असफल होते हैं।

### `ctx.dataQuality` (अन्य प्लगिन के लिए)

```ts
const result = await ctx.dataQuality.verifyCitations({
  dataset: 'holdings.csv',          // workspaceRoot के विरुद्ध हल
  citations: [
    { id: 'c1', path: 'rows[3].nav', value: 1.234, tolerance: 0.01 },
    { id: 'c2', path: 'summary.annualReturn', value: '12.34%' },
  ],
})
// result.results[i] = { id, status: 'verified' | 'mismatch' | 'not-found' | 'unverifiable', actual?, note? }
```

लोकेटर डेटासेट दस्तावेज़ पर चलते हैं: CSV/TSV `{ columns, rows }` के रूप में लोड होते हैं (इसलिए `rows[3].nav` हल होता है), JSON पार्स किया गया मान है, JSONL पार्स की गई पंक्तियों की सरणी। संख्याएँ सापेक्ष सहिष्णुता से तुलना करती हैं (`|a-b| <= tolerance * max(|a|, |b|)`); संख्यात्मक रूप से पार्स होने वाली CSV स्ट्रिंग सेल संख्या की तरह तुलना करती है; स्ट्रिंग सटीक तुलना करती हैं; असंगत प्रकार-युग्म `unverifiable` हैं। सेवा `profileDataset` / `cleanDataset` / `verifyDataset` भी उजागर करती है (वही क्रियाएँ जो टूल कॉल करते हैं)।

## Permissions & data

- **पढ़ता है** वर्कस्पेस डेटासेट फ़ाइलें (केवल अनुमत एक्सटेंशन)।
- **लिखता है** केवल: `data_clean` की आउटपुट फ़ाइल (स्पष्ट `outputPath`, वर्कस्पेस-सीमित, कभी इनपुट नहीं) और harness डेटा निर्देशिका के `data_quality` स्टोरेज डोमेन की रिपोर्ट।
- **कोई नेटवर्क नहीं, कोई क्रेडेंशियल नहीं, कोई बाहरी प्रक्रिया नहीं** — सारा पार्सिंग और सांख्यिकी इन-प्रोसेस TypeScript है।
- रिपोर्ट में आपके डेटासेट के नमूना सेल मान हो सकते हैं (`evidenceRowLimit` और डिस्प्ले ट्रंकेशन से सीमित); सत्र लॉग सामान्य रूप से टूल तर्क और परिणाम रिकॉर्ड करता है।

## Security boundaries

- **पथ सीमांकन** — डेटासेट और आउटपुट पथ सत्र वर्कस्पेस के भीतर हल होने चाहिए (`verifyCitations` `workspaceRoot` उपयोग करता है); `..` एस्केप और रूट से बाहर के निरपेक्ष पथ अस्वीकृत, तुलना से पहले दोनों पक्ष सामान्यीकृत (Windows स्लैश-सुरक्षित)।
- **सीमित कार्य** — `maxRows` / `maxFileSizeMB` गार्ड अधिक बड़े इनपुट को ठोस रूप से अस्वीकार करते हैं; abort सिग्नल लंबे लोड को बीच में रोकते हैं।
- **कोई अधिलेखन नहीं** — `data_clean` इनपुट पथ के समान `outputPath` अस्वीकार करता है।
- **निर्धारणात्मक गणना** — समान इनपुट, समान आउटपुट; एकमात्र घड़ी `freshness` डिफ़ॉल्ट और रिपोर्ट टाइमस्टैम्प के लिए इंजेक्ट की गई है।

## Known limitations

- **सत्र ईवेंट अनुकूली हैं।** प्रकाशित `0.1.2-rc.1` लाइन (पहले की rc लाइनों की तरह) में प्लगिन सत्र-ईवेंट पंजीकरण सतह नहीं है और उसका `Session.append` `ignorable` चिह्न नहीं लगा सकता; अज्ञात `data-quality/*` प्रकार जोड़ने से सत्र लॉग पुनः स्थापना पर अस्वीकार हो जाएगा। इसलिए प्लगिन केवल तब जोड़ता है जब होस्ट शब्दावली जानता हो या `ignorable` append फ़्लैग समर्थित हो; प्रकाशित लाइन पर स्टोरेज-डोमेन रिपोर्ट ही टिकाऊ रिकॉर्ड है।
- **CSV बोली** — RFC-4180 उद्धरण के साथ अल्पविराम/टैब, हेडर पंक्ति आवश्यक, रिक्त पंक्तियाँ छोड़ी जाती हैं; डिलीमीटर स्व-पहचान या टिप्पणी पंक्तियाँ नहीं।
- **प्रकार पार्सिंग सख़्त है** — संख्याओं में सहस्र विभाजक नहीं; तिथियाँ `YYYY-MM-DD` / `YYYY/MM/DD` / ISO-शैली datetime (UTC); बूलियन `true/false/yes/no/1/0`। बाक़ी सब `string`/`mixed` प्रोफ़ाइल होता है — इरादा हो तो `coerce-type` से क्लीन करें।
- **टूल के लिए JSON तालिकीय होना चाहिए** (सपाट ऑब्जेक्ट की सरणी); `verifyCitations` मनमाने JSON दस्तावेज़ों पर चलता है।
- **कोई ML विसंगति पहचान नहीं, कोई PII मास्किंग नहीं, कोई डेटाबेस नहीं, कोई SQL नहीं** — केवल नियम-आधारित संदेह टिप्पणियाँ।

## Development

```sh
pnpm install
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build
pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm run verify:readme-sync && pnpm pack
```

- टेस्ट 0.1.2-rc.1 peers के वास्तविक `Context`/`Session`/`ToolRuntime`/स्टोरेज डोमेन के विरुद्ध vitest चलाते हैं (हाथ से लिखे सेवा mock नहीं) और शुद्ध इंजन specs; हर क्लीन/सत्यापन नियम के सकारात्मक और नकारात्मक केस हैं, और `verifyCitations` चारों स्थितियों को कवर करता है।
- `scripts/loader-runner.mjs` वास्तविक Loader संयोजन बूट करता है और API कुंजी के बिना `fixtures/` पर प्रोफ़ाइल → क्लीन → सत्यापन श्रृंखला चलाता है।
- रिलीज़: `node scripts/release.mjs <x.y.z>` (कभी push नहीं; टैग `release.yml` ट्रिगर करता है)।

## Topics

`dsh` · `dsh-plugin` · `deepseek-harness` · `cordis` · `data-quality` · `data-cleaning` · `data-profiling` · `data-verification`

## Contributors

इस प्लगिन को आकार देने वाले सभी का धन्यवाद।

- **PerryLink** — रखरखाव और रिलीज़ (`0.1.2`/`0.1.3`), peer-dependencies उन्नयन, npm version/downloads/CI बैज, और हालिया सुधार।
- **dsh-data-quality contributors** — प्रारंभिक scaffold, `ctx.dataQuality` सीम और फ्रोज़न `verifyCitations` अनुबंध, नियतात्मक डेटासेट परत और शुद्ध इंजन, `data_quality` स्टोरेज-डोमेन रिपोर्ट, वास्तविक-सेवा vitest सुइट, CI/compat/release वर्कफ़्लो, और पाँच-भाषा README।

इस रिपॉजिटरी का अभी कोई सार्वजनिक issue या pull request इतिहास नहीं है; आने पर PR/issue संख्याएँ यहाँ अंकित की जाएँगी।

## PerryLink DSH Plugin Family

यह प्लगिन साझा DSH परिवार इंजीनियरिंग परिपाटियों का पालन करता है: bundle-मैनिफ़ेस्ट पैकेजिंग (`dsh.bundle` + `cordis.patch.yml`), सिंक जाँच से बंधे पाँच-भाषा README, ठोस-असफल Schemastery कॉन्फ़िगरेशन, वास्तविक-सेवा vitest कवरेज, और तीन-वर्कफ़्लो CI/compat/release श्रृंखला।

## PerryLink DSH Plugin Family

यह प्रोजेक्ट [PerryLink](https://github.com/PerryLink) द्वारा अनुरक्षित [33 DeepSeek Harness प्लगइनों](https://github.com/PerryLink) में से एक है। अगर यह आपकी मदद करता है, तो बाकी भी करेंगे:

| Plugin | One-liner |
|---|---|
| **[dsh-dsh-auto-review](https://github.com/PerryLink/dsh-dsh-auto-review)** | अनुमोदन श्रृंखला पर द्वितीय-मॉडल स्वतः-समीक्षा, डिफ़ॉल्ट रूप से विफल-बंद | |
| **[dsh-dsh-background-agents](https://github.com/PerryLink/dsh-dsh-background-agents)** | वेब UI साइडबार, संदेश और अवरोधन के साथ टिकाऊ पृष्ठभूमि चाइल्ड एजेंट | |
| **[dsh-dsh-budget](https://github.com/PerryLink/dsh-dsh-budget)** | DeepSeek Harness के लिए लागत प्रशासन: बजट, कार्बन और विलंबता एक पैनल में। | |
| **[dsh-dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-dsh-checkpoint-rewind)** | Claude Code /rewind-समतुल्य: स्नैपशॉट, सत्र फ़ॉर्क, एक-बार पुनर्स्थापना | |
| **[dsh-dsh-claude-move](https://github.com/PerryLink/dsh-dsh-claude-move)** | Claude Code सत्र, मेमोरी, कौशल और CLAUDE.md को DSH में स्थानांतरित करें | |
| **[dsh-dsh-click](https://github.com/PerryLink/dsh-dsh-click)** | DeepSeek Harness के लिए क्रॉस-प्लेटफ़ॉर्म नेटिव डेस्कटॉप नियंत्रण — Windows पहले। | |
| **[dsh-dsh-composer-history](https://github.com/PerryLink/dsh-dsh-composer-history)** | वेब कंपोज़र के लिए टर्मिनल-शैली इनपुट इतिहास: तीर, Ctrl+R खोज | |
| **[dsh-dsh-defend](https://github.com/PerryLink/dsh-dsh-defend)** | DeepSeek Harness के लिए प्रॉम्प्ट-इंजेक्शन, जेलब्रेक और सीक्रेट-लीक रक्षा। | |
| **[dsh-dsh-doublecheck](https://github.com/PerryLink/dsh-dsh-doublecheck)** | इंजीनियरिंग-अनुशासन रक्षक: आवश्यकताओं की पूछताछ, परीक्षण द्वार, प्रतिद्वंद्वी समीक्षा | |
| **[dsh-dsh-draw](https://github.com/PerryLink/dsh-dsh-draw)** | DeepSeek Harness के लिए एकीकृत स्थैतिक-छवि निर्माण रूटिंग। | |
| **[dsh-dsh-fast](https://github.com/PerryLink/dsh-dsh-fast)** | DeepSeek Harness के लिए रीड-ओनली प्रदर्शन डायग्नोस्टिक्स। | |
| **[dsh-dsh-fund-research](https://github.com/PerryLink/dsh-dsh-fund-research)** | चीनी सार्वजनिक म्यूचुअल फंड के लिए नियतात्मक अनुसंधान रिपोर्ट | |
| **[dsh-dsh-github](https://github.com/PerryLink/dsh-dsh-github)** | DSH के लिए GitHub PR/issues एकीकरण, हर लेखन अनुमोदन-द्वारित | |
| **[dsh-dsh-industry-research](https://github.com/PerryLink/dsh-dsh-industry-research)** | उद्योग-अनुसंधान ऑर्केस्ट्रेशन जो इस प्लगिन के `ctx.researchReport.assemble` से डिलीवरेबल सील करता है | |
| **[dsh-dsh-library](https://github.com/PerryLink/dsh-dsh-library)** | DeepSeek Harness के लिए स्थानीय दस्तावेज़ ज्ञानकोश। | |
| **[dsh-dsh-local-ai](https://github.com/PerryLink/dsh-dsh-local-ai)** | DeepSeek Harness के लिए स्थानीय-मॉडल (Ollama) एकीकरण। | |
| **[dsh-dsh-lsp-actions](https://github.com/PerryLink/dsh-dsh-lsp-actions)** | भाषा सर्वरों पर LSP निदान, फ़ॉर्मेटिंग, पूर्णता, कोड क्रियाएँ और नाम बदलना | |
| **[dsh-dsh-mask](https://github.com/PerryLink/dsh-dsh-mask)** | PII मास्किंग मिडलवेयर: मॉडल सीमा पर अनाम करें, डिस्प्ले लेयर पर पुनर्स्थापित करें | |
| **[dsh-dsh-mcp-panel](https://github.com/PerryLink/dsh-dsh-mcp-panel)** | केवल-पढ़ने वाला MCP रनटाइम पैनल: /mcp कमांड + स्थिति, टूल और त्रुटियों वाला Settings टैब | |
| **[dsh-dsh-memento](https://github.com/PerryLink/dsh-dsh-memento)** | अनुमोदन-द्वारित क्रॉस-सत्र मेमोरी: ctx.memory सीम + SQLite + मेमोरी टूल | |
| **[dsh-dsh-observe](https://github.com/PerryLink/dsh-dsh-observe)** | DeepSeek Harness के लिए OpenTelemetry और Langfuse अवलोकनीयता निर्यातक। | |
| **[dsh-dsh-output-styles](https://github.com/PerryLink/dsh-dsh-output-styles)** | Claude Code outputStyles-समतुल्य रनटाइम शैली बदलाव | |
| **[dsh-dsh-permission-rules](https://github.com/PerryLink/dsh-dsh-permission-rules)** | ऑडिट के साथ Claude Code-शैली घोषणात्मक allow/deny/ask अनुमति नियम | |
| **[dsh-dsh-plugin-guide](https://github.com/PerryLink/dsh-dsh-plugin-guide)** | माँग पर एजेंट कौशल के रूप में प्लगइन-विकास ज्ञान आधार | |
| **[dsh-dsh-research-report](https://github.com/PerryLink/dsh-dsh-research-report)** | सामग्री-पता साक्ष्य और सीलबंद संस्करणों वाला सत्यापन-योग्य अनुसंधान-रिपोर्ट इंजन | |
| **[dsh-dsh-score](https://github.com/PerryLink/dsh-dsh-score)** | DeepSeek Harness प्लगिनों की बहु-आयामी गुणवत्ता स्कोरिंग। | |
| **[dsh-dsh-session-pin](https://github.com/PerryLink/dsh-dsh-session-pin)** | टिकाऊ क्रम के साथ वेब साइडबार में सत्र पिन करें | |
| **[dsh-dsh-session-sync](https://github.com/PerryLink/dsh-dsh-session-sync)** | DeepSeek Harness के लिए क्रॉस-डिवाइस सत्र सिंक — आपके सत्र स्टोर का एक समर्पित git मिरर। | |
| **[dsh-dsh-skill-pack-security](https://github.com/PerryLink/dsh-dsh-skill-pack-security)** | सुरक्षा-ऑडिट कौशल पैक: गुप्त स्कैन, निर्भरता और आपूर्ति-श्रृंखला समीक्षा | |
| **[dsh-dsh-talk](https://github.com/PerryLink/dsh-dsh-talk)** | DeepSeek Harness के लिए आवाज़-प्रथम सत्र लूप: बोलें और उत्तर सुनें। | |
| **[dsh-dsh-test-drive](https://github.com/PerryLink/dsh-dsh-test-drive)** | DeepSeek Harness प्लगिनों के लिए पृथक इंस्टॉल-एंड-स्मोक टेस्ट ड्राइव। | |
| **[dsh-dsh-translate](https://github.com/PerryLink/dsh-dsh-translate)** | DeepSeek Harness के लिए वेंडर पैरामीटर अनुवाद और नियतात्मक JSON मरम्मत। | |

## License

Apache-2.0 — देखें [LICENSE](LICENSE) और [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)।

### DSH Desktop मार्केट से इंस्टॉल करें

सभी PerryLink प्लगइन DSH Desktop के बिल्ट-इन मार्केट में देखे जा सकते हैं: **Market → Sources → add source → पेस्ट करें** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ चुनें**। इंस्टॉलेशन मार्केट के npm-identity सत्यापन और आपकी पुष्टि से ही होता है।
