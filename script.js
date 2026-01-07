// JavaScript Document
// @ts-check
'use strict';
// ============================================================
// ----- constants -----
const PAGES_PER_SHEET = 4;
const MAX_PAGES = 200;

// ============================================================
// ----- utilitys -----

/**
 * @typedef {number} SafeNonNegativeInteger
 * @description BigInt ではない安全な非負整数
 */

/**
 * 入力値を検証する関数: input が "BigInt でない 0 以上の整数" であるか否かを返す
 * @param {any} input
 * @returns {input is SafeNonNegativeInteger}
 */
const isSafeNonNegativeInteger = (input) => {
  return input >= 0 && Number.isSafeInteger(input);
};

/**
 * @typedef {number} SafePositiveInteger
 * @description 0 より大きく BigInt ではない安全な整数
 */

/**
 * 入力値を検証する関数: input が "BigInt でない 0 より大きい整数" であるか否かを返す
 * @param {any} input
 * @returns {input is SafePositiveInteger}
 */
const isSafePositiveInteger = (input) => {
  return input > 0 && Number.isSafeInteger(input);
};

// 厳格なホワイトリスト
/**
 * ElementPropsKey についての Single Source of Truth
 * elementPropsKeyList とコンフリクトするなら、こちらが正しい
 * @typedef {'id' | 'className' | 'for' | 'textContent' | 'type' | 'name' | 'value' | 'checked' | 'for' | 'min' | 'max'} ElementPropsKey
 */

/**
 * createElement 関数の第二引数 props のキーについて、
 * ホワイトリストで許可された文字列か判定する関数
 * @param {any} maybeKey
 * @returns {maybeKey is ElementPropsKey}
 */
const isElementPropsKey = (maybeKey) => {
  /** @type {ElementPropsKey[]} */
  const elementPropsKeyList = [
    'id',
    'className',
    'textContent',
    'type',
    'name',
    'value',
    'checked',
    'for',
    'min',
    'max'
  ];
  return elementPropsKeyList.includes(maybeKey);
};

const allowedPropsValueTypeList = ['number', 'radio', 'checkbox', 'button'];

/**
 * @type {{[key in ElementPropsKey]: (val: string) => boolean}}
 */
const elementPropsValueValidatorMap = {
  id: (val) => /^[A-Za-z][\w-]*$/.test(val),

  className: (val) => /^[A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*$/.test(val),

  name: (val) => /^[A-Za-z0-9_-]+$/.test(val),

  type: (val) => allowedPropsValueTypeList.includes(val),

  value: (_val) => true,

  textContent: (_val) => true,

  checked: (val) => val === 'true' || val === 'false',

  min: (val) => /^-?\d+$/.test(val),

  max: (val) => /^-?\d+$/.test(val),

  for: (val) => /^[A-Za-z][\w-]*$/.test(val)
};

/**
 * @type {{[key in ElementPropsKey]: (el: HTMLElement, val: string) => void}}
 */
const elementPropsKeyMap = {
  id: (el, val) => {
    el.id = String(val);
  },
  className: (el, val) => {
    el.className = String(val);
  },
  textContent: (el, val) => {
    el.textContent = String(val);
  },
  type: (el, val) => {
    if (el instanceof HTMLInputElement === false && el instanceof HTMLButtonElement === false) return;
    el.type = String(val);
  },
  name: (el, val) => {
    if (el instanceof HTMLInputElement === false) return;
    el.name = String(val);
  },
  value: (el, val) => {
    if (el instanceof HTMLInputElement === false) return;
    el.value = String(val);
  },
  min: (el, val) => {
    if (el instanceof HTMLInputElement === false) return;
    el.min = String(val);
  },
  max: (el, val) => {
    if (el instanceof HTMLInputElement === false) return;
    el.max = String(val);
  },
  checked: (el, val) => {
    if (el instanceof HTMLInputElement === false) return;
    const stringVal = String(val);
    if (stringVal === 'true') el.checked = true;
    if (stringVal === 'false') el.checked = false;
  },
  for: (el, val) => {
    if (el instanceof HTMLLabelElement === false) return;
    el.htmlFor = String(val);
  }
};

/**
 * HTML 要素を安全に作成するヘルパー
 * 重要: ** 例外を投げる **
 * @param {string} tag
 * @param {{[key: string]: string | null}} props
 * @param  {...(HTMLElement | string | number | null | undefined)} children
 * @returns {HTMLElement}
 */
const createElement = (tag, props = {}, ...children) => {
  const element = document.createElement(tag);
  if (element instanceof HTMLUnknownElement) throw new Error(`Invalid tagName '${tag}' detected and skipped.`);

  // 属性の設定
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;

    if (!isElementPropsKey(key)) {
      throw new Error(`Prohibited property '${key}' detected and skipped.`);
    }

    if (typeof value !== 'string') {
      throw new Error(`Invalid value for property '${key}': ${value}`);
    }

    if (!elementPropsValueValidatorMap[key](value)) {
      throw new Error(`Invalid value for property '${key}': ${value}`);
    }

    elementPropsKeyMap[key](element, value);
  }

  // 子要素の追加
  children.forEach((child) => {
    if (child == null) return;

    if (child instanceof HTMLElement) {
      element.appendChild(child);
    } else {
      // 文字列や数値はテキストノードとして追加
      element.appendChild(document.createTextNode(String(child)));
    }
  });

  return element;
};

// ============================================================
// ----- Model -----
/**
 * 入力値から総ページ数、空白ページ数と印刷用紙の枚数を割り出す関数
 * @param {SafePositiveInteger} inputtedPages
 * @returns {{
 *    blankPages?: undefined;
 *    allPages?: undefined;
 *    sheets? : undefined;
 *    error: {__brand: 'pageCalculationError'; message: string;};
 * } | {
 *    blankPages: SafePositiveInteger;
 *    allPages: SafePositiveInteger;
 *    sheets: SafePositiveInteger;
 *    error: null;
 * }}
 */
const calcPages = (inputtedPages) => {
  const remainder = inputtedPages % PAGES_PER_SHEET;
  // -> 0, 1, 2, 3
  const blankPages = remainder === 0 ? 0 : PAGES_PER_SHEET - remainder;
  const allPages = remainder === 0 ? inputtedPages : inputtedPages + blankPages;

  if (allPages > MAX_PAGES) return { error: { __brand: 'pageCalculationError', message: 'ページ数が多すぎます' } };

  const sheets = allPages / PAGES_PER_SHEET;

  return { blankPages, allPages, sheets, error: null };
};

// --- ^^^ --- 改修予定 --- ^^^ ---

/**
 * @typedef {{
 *  index: number;
 *  indexToDisplay: number;
 *  content: {
 *    front: {
 *      left: number | string;
 *      right: number | string;
 *    };
 *    back: {
 *      left: number | string;
 *      right: number | string;
 *    };
 *  };
 *  isColorPrint: boolean;
 * }} SheetData
 */

/**
 * ある印刷用紙に対して、それがカラー印刷であるか否かを判定する補助関数
 * @param {number} index
 * @param {SafePositiveInteger} sheets
 * @param {SafePositiveInteger} startEndColorSheets
 * @param {SafePositiveInteger} centerColorSheets
 * @returns {boolean}
 */
const getColorPrint = (index, sheets, startEndColorSheets, centerColorSheets) => {
  if (index < startEndColorSheets) return true;
  if (index >= sheets - centerColorSheets) return true;
  return false;
};

/**
 * @typedef {'excluding' | 'including'} CoverOption
 */

/**
 *
 * @param {any} arg
 * @returns {arg is CoverOption}
 */
const isCoverOption = (arg) => {
  const coverOptionList = ['excluding', 'including'];
  return coverOptionList.includes(arg);
};

/**
 * @typedef {{
 *  [key in CoverOption]: ({ allPages, sheets, startEndColorSheets, centerColorSheets }: {
 *    allPages: SafePositiveInteger;
 *    sheets: SafePositiveInteger;
 *    startEndColorSheets: SafeNonNegativeInteger;
 *    centerColorSheets: SafeNonNegativeInteger;
 *  }) => SheetData[]}} DataListCreatorKeyMap
 */
/**
 * @type {DataListCreatorKeyMap}
 */
const dataListCreatorKeyMap = {
  excluding: ({ allPages, sheets, startEndColorSheets, centerColorSheets }) => {
    const sheetDataList = Array.from({ length: sheets }, (_, i) => {
      const isColorPrint = getColorPrint(i, sheets, startEndColorSheets, centerColorSheets);

      /** @type {SheetData} */
      const sheetData = {
        index: i,
        indexToDisplay: i + 1,
        content: {
          front: {
            left: allPages - i * 2,
            right: 1 + i * 2
          },
          back: {
            left: 2 + i * 2,
            right: allPages - 1 - i * 2
          }
        },
        isColorPrint
      };

      return sheetData;
    });

    return sheetDataList;
  },

  including: ({ allPages, sheets, startEndColorSheets, centerColorSheets }) => {
    /** @type {SheetData} */
    const cover = {
      index: -1,
      indexToDisplay: 1,
      content: {
        front: {
          left: '裏表紙',
          right: '表紙'
        },
        back: {
          left: '',
          right: ''
        }
      },
      isColorPrint: true
    };

    const contentDataList = dataListCreatorKeyMap['excluding']({
      allPages,
      sheets,
      startEndColorSheets,
      centerColorSheets
    });

    return [
      cover,
      ...contentDataList.map((sheetData) => {
        sheetData.indexToDisplay++;
        return sheetData;
      })
    ];
  }
};

/**
 * 描画を担当する関数に渡すためのデータを配列形式で作る関数
 * @param {object} configs
 * @param {SafePositiveInteger} configs.allPages
 * @param {SafePositiveInteger} configs.sheets
 * @param {SafePositiveInteger} configs.startEndColorSheets
 * @param {SafePositiveInteger} configs.centerColorSheets
 * @param {CoverOption} configs.coverOption
 * @returns {{
 *  dataList: SheetData[]; error: null;
 * } | {
 *  dataList?: undefined; error: {__brand: 'dataListCreationError'; message: string}
 * }}
 */
const createDataListToRender = ({
  allPages,
  sheets,
  startEndColorSheets,
  centerColorSheets,
  coverOption = 'excluding'
}) => {
  if (!isCoverOption(coverOption))
    return {
      error: {
        __brand: 'dataListCreationError',
        message: `Error: Invalid value '${coverOption}' detected and skipped.`
      }
    };
  const dataList = dataListCreatorKeyMap[coverOption]({ allPages, sheets, startEndColorSheets, centerColorSheets });

  return { dataList, error: null };
};

/**
 * インプットを受け取り、UI に表示するべきデータに変換する処理
 * 重要: ** 例外を投げる関数 **
 * @param {object} inputs
 * @param {SafePositiveInteger} inputs.inputtedPages
 * @param {SafePositiveInteger} inputs.startEndColorPages
 * @param {SafePositiveInteger} inputs.centerColorPages
 * @param {CoverOption} inputs.coverOption
 * @returns {{dataListToRender: SheetData[]; blankPages: SafePositiveInteger;}}
 */
const buildPrintModel = ({ inputtedPages, startEndColorPages, centerColorPages, coverOption }) => {
  const { blankPages, allPages, sheets, error: calcPagesError } = calcPages(inputtedPages);
  if (calcPagesError) throw new Error(calcPagesError.message);

  if (allPages < startEndColorPages + centerColorPages) throw new Error(`カラーページが総ページ数を超えています。`);

  const { sheets: startEndColorSheets, error: startEndColorPagesError } = calcPages(startEndColorPages);
  if (startEndColorPagesError) throw new Error(startEndColorPagesError.message);

  const { sheets: centerColorSheets, error: centerColorPagesError } = calcPages(centerColorPages);
  if (centerColorPagesError) throw new Error(centerColorPagesError.message);

  const { dataList: dataListToRender, error: dataListCreationError } = createDataListToRender({
    allPages,
    sheets,
    startEndColorSheets,
    centerColorSheets,
    coverOption
  });

  if (dataListCreationError) throw new Error(dataListCreationError.message);

  return { dataListToRender, blankPages };
};

//============================================================
// ----- View -----

/**
 * ラジオボタンを作成するヘルパー
 * @param {CoverOption} coverOption
 * @param {boolean} isChecked
 * @returns {HTMLInputElement}
 */
const createCoverOptionRadio = (coverOption, isChecked) => {
  // @ts-ignore
  return createElement('input', {
    type: 'radio',
    id: coverOption + 'Cover',
    name: 'coverOption',
    value: coverOption,
    checked: isChecked ? 'true' : 'false'
  });
};

/**
 * 数値の入力フォームを作成するヘルパー
 * @param {string} id
 * @param {string} className
 * @param {{[key: string]: string | null}} minmax
 * @returns {HTMLInputElement}
 */
const createPagesInput = (id, className, { value, min, max } = { value: '0', min: '0', max: null }) => {
  // @ts-ignore
  return createElement('input', {
    type: 'number',
    className,
    value,
    min,
    max,
    id
  });
};

/**
 * 数値の入力フォームのラベルとコンテナを作成するヘルパー
 * @param {HTMLInputElement} el
 * @param {string} text
 * @returns
 */
const createFormGroupNumber = (el, text) => {
  return createElement(
    'div',
    { className: 'form-group-number' },
    createElement('label', { for: el.id, textContent: text }),
    el
  );
};

/**
 * 入力フォーム用の DOM を生成する関数
 * @param {Function} onSubmitCallback
 */
const createInputEntry = (onSubmitCallback) => {
  // 1. 各入力フィールドの作成
  const coverOptionRadioExcluding = createCoverOptionRadio('excluding', true);
  const coverOptionRadioIncluding = createCoverOptionRadio('including', false);

  const pagesInput = createPagesInput('input-page-count', 'input-page', { value: '1', min: '1', max: '200' });
  const startEndColorPagesInput = createPagesInput('input-start-end-color', 'input-page');
  const centerColorPagesInput = createPagesInput('input-center-color', 'input-page');

  // 2. サブミットボタンの作成
  const submitButton = createElement('button', {
    type: 'button',
    className: 'button-submit',
    textContent: '確定'
  });

  // 3. イベントリスナーの設定 -->> 分離
  submitButton.addEventListener('click', () => {
    const checkedCoverOptionRadio = [coverOptionRadioExcluding, coverOptionRadioIncluding].find(
      (radio) => radio.checked
    );
    if (checkedCoverOptionRadio == null) return;

    const inputs = {
      inputtedPages: parseInt(pagesInput.value, 10),
      startEndColorPages: parseInt(startEndColorPagesInput.value, 10),
      centerColorPages: parseInt(centerColorPagesInput.value, 10),
      coverOption: checkedCoverOptionRadio.value
    };

    onSubmitCallback(inputs);
  });

  // 4. 全体をレイアウト用コンテナにまとめる
  return createElement(
    'div',
    { className: 'entry-container centerXY' },
    // --- ラジオボタン ---
    createElement(
      'fieldset',
      {},
      createElement('legend', { textContent: '表紙の設定' }),
      createElement(
        'div',
        { className: 'form-group-radio' },
        coverOptionRadioExcluding,
        createElement('label', { for: coverOptionRadioExcluding.id, textContent: '含まない' })
      ),
      createElement(
        'div',
        { className: 'form-group-radio' },
        coverOptionRadioIncluding,
        createElement('label', { for: coverOptionRadioIncluding.id, textContent: '含む' })
      )
    ),
    // --- ページ数入力 ---
    createFormGroupNumber(pagesInput, 'ページ数: '),
    createFormGroupNumber(startEndColorPagesInput, '巻頭巻末カラー: '),
    createFormGroupNumber(centerColorPagesInput, 'センターカラー: '),
    createElement('div', { className: 'button-submit-container' }, submitButton)
  );
};

/**
 * 印刷用紙の裏表両面に対応する DOM を生成する関数
 * @param {{
 *  front: {
 *     left: string | number;
 *     right: string | number;
 *  };
 *  back: {
 *      left: string | number;
 *      right: string | number;
 *  };
 * }} sheetDataContent
 * @returns {HTMLElement[]}
 */
const createSides = ({ front, back }) => {
  /**
   * @param {'left' | 'right'} position
   * @param {string | number} value
   * @returns {HTMLElement}
   */
  const renderPage = (position, value) =>
    createElement('div', { className: `${position} centerXY page-number`, textContent: `${value}` });

  return [
    createElement('div', { className: 'front' }, renderPage('left', front.left), renderPage('right', front.right)),
    createElement('div', { className: 'back' }, renderPage('left', back.left), renderPage('right', back.right))
  ];
};

/**
 * sheetData の配列から DOM を生成して、ユーザーに見える形で表示する関数
 * @param {SheetData[]} dataListToRender
 */
const renderSheetTable = (dataListToRender) => {
  const pagesTable = document.getElementById('pages-table');
  if (pagesTable === null) return;

  while (pagesTable.firstChild) pagesTable.removeChild(pagesTable.firstChild);

  const fragment = document.createDocumentFragment();

  dataListToRender.forEach((sheetData) => {
    const isColorPrint = sheetData.isColorPrint;

    const row = createElement(
      'div',
      { className: `pages-table-row ${isColorPrint ? 'color-print-sheet' : ''}`.trim() },
      createElement('div', { className: 'sheet-number centerXY', textContent: `${sheetData.indexToDisplay}` }),
      ...createSides(sheetData.content),
      createElement('div', { className: 'modifier centerXY', textContent: `${isColorPrint ? 'カラー' : ''}` })
    );

    fragment.appendChild(row);
  });

  pagesTable.appendChild(fragment);
};

/**
 * 空白ページを何枚追加する必要があるかテキストを表示する関数
 * @param {SafePositiveInteger} blankPages
 * @returns
 */
const renderBlankPagesText = (blankPages) => {
  const container = document.getElementById('blank-page-container');
  if (container == null) return;

  while (container.firstChild) container.removeChild(container.firstChild);

  if (blankPages === 0) return;

  const blankPagesText = createElement('div', {
    id: 'blank-pages-text',
    className: 'centerXY blank-pages-text',
    textContent: `空白ページを${blankPages}ページ用意してください。`
  });

  container.appendChild(blankPagesText);
};

/**
 *
 * @param {object} printModel
 * @param {SheetData[]} printModel.dataListToRender
 * @param {SafePositiveInteger} printModel.blankPages
 */
const renderUI = ({ dataListToRender, blankPages }) => {
  renderSheetTable(dataListToRender);

  renderBlankPagesText(blankPages);
};

const initView = () => {
  const body = document.body;

  const inputEntry = createInputEntry(onSubmitCallback);

  const blankPageContainer = createElement('div', { id: 'blank-page-container' });

  const pagesTableHead = createElement(
    'div',
    { className: 'pages-table-head' },
    createElement('div', { className: 'head-front centerXY', textContent: 'オモテ' }),
    createElement('div', { className: 'head-back centerXY', textContent: 'ウラ' })
  );
  const pagesTable = createElement('div', { id: 'pages-table', className: 'pages-table' });

  body.appendChild(inputEntry);
  body.appendChild(pagesTableHead);
  body.appendChild(pagesTable);
  body.appendChild(blankPageContainer);
};

// ============================================================
// ----- Controller -----

/**
 *
 * @param {{
 *  inputtedPages: any;
 *  startEndColorPages: any;
 *  centerColorPages: any;
 *  coverOption: any;}} data
 * @returns {{
 *  inputtedPages: SafePositiveInteger;
 *  startEndColorPages: SafeNonNegativeInteger;
 *  centerColorPages: SafeNonNegativeInteger;
 *  coverOption: CoverOption;
 *  error: null;
 * } | {
 *  inputtedPages?: undefined;
 *  startEndColorPages?: undefined;
 *  centerColorPages?: undefined;
 *  coverOption?: undefined;
 *  error: {__brand: 'dataValidationError'; message: string};
 * }}
 */
const validateInputs = ({ inputtedPages, startEndColorPages, centerColorPages, coverOption }) => {
  if (inputtedPages == null || startEndColorPages == null || centerColorPages == null || coverOption == null)
    return { error: { __brand: 'dataValidationError', message: 'one or more value is null or undefined.' } };

  if (!isSafePositiveInteger(inputtedPages))
    return { error: { __brand: 'dataValidationError', message: 'Inputted pages is not safe positive integer.' } };

  if (!isSafeNonNegativeInteger(startEndColorPages) || !isSafeNonNegativeInteger(centerColorPages))
    return {
      error: { __brand: 'dataValidationError', message: 'One or more value is not safe non-negative integer.' }
    };
  if (!isCoverOption(coverOption))
    return {
      error: { __brand: 'dataValidationError', message: `Invalid value '${coverOption}' detected and skipped.` }
    };

  return { inputtedPages, startEndColorPages, centerColorPages, coverOption, error: null };
};

/**
 *
 * @param {{
 *  inputtedPages: any;
 *  startEndColorPages: any;
 *  centerColorPages: any;
 *  coverOption: any;}} inputs
 * @returns
 */
const onSubmitCallback = (inputs) => {
  const result = validateInputs(inputs);
  if (result.error) {
    // renderError(result.error.message);
    return;
  }

  handleChange(result);
};

/**
 *
 * @param {object} inputs
 * @param {SafePositiveInteger} inputs.inputtedPages
 * @param {SafeNonNegativeInteger} inputs.startEndColorPages
 * @param {SafeNonNegativeInteger} inputs.centerColorPages
 * @param {CoverOption} inputs.coverOption
 * @returns
 */
const handleChange = ({ inputtedPages, startEndColorPages, centerColorPages, coverOption }) => {
  try {
    const printModel = buildPrintModel({ inputtedPages, startEndColorPages, centerColorPages, coverOption });

    renderUI(printModel);
  } catch (error) {
    console.error(error);
  }
};

// ============================================================
// ----- execution -----
initView();
