import { ICardSetUelSetting, IUelSetting } from "../constants/defaultUelSetting";
import RegexParser from "regex-parser";

const _doubleBackSlash = (str) => str.replace(/\\/g, "\\\\");

const _toRegExpDoubleBackslash = (str, options = "") => new RegExp(RegexParser(_doubleBackSlash(str)), options);
const _mergeUelSettings = (uel: IUelSetting, cardSetUel: ICardSetUelSetting) => {
  const composed: IUelSetting = { ...uel };

  if (cardSetUel.blacklist) composed.blacklist = [...composed.blacklist, ...cardSetUel.blacklist];
  if (cardSetUel.whitelist) composed.whitelist = [...composed.whitelist, ...cardSetUel.whitelist];
  if (cardSetUel.words_to_strip) composed.words_to_strip = [...composed.words_to_strip, ...cardSetUel.words_to_strip];
  if (cardSetUel.grades_to_strip)
    composed.grades_to_strip = [...composed.grades_to_strip, ...cardSetUel.grades_to_strip];

  return composed;
};

const passesFilter = (
  title: string,
  uelSetting: IUelSetting,
  cardSetUelSetting: ICardSetUelSetting | null = null,
  debug = false,
): { isValid: boolean; errors: string[] } => {
  const { emoji_regex, punctuation_to_strip_regex, punctuation_pattern_regex, grade_punctuation_pattern_regex } =
    uelSetting;

  let isValid = true;
  const errors: string[] = [];

  const singleDigitParenthesisMatch = title.match(/\([2-9]\)/gi);
  if (singleDigitParenthesisMatch) {
    const errorMsg = `Matched with single digit between parenthesis: ${singleDigitParenthesisMatch.join(",")}`;
    errors.push(errorMsg);

    if (debug) console.log(errorMsg);
    isValid = false;
  }

  let setting = uelSetting;
  if (cardSetUelSetting) setting = _mergeUelSettings(uelSetting, cardSetUelSetting);

  const { blacklist, whitelist, words_to_strip, grades_to_strip } = setting;

  let blacklistPass = true;
  blacklist.forEach((blacklistTerm: string) => {
    if (title.indexOf(blacklistTerm) > -1) {
      const errorMsg = `Matched with blacklisted term: ${blacklistTerm}.`;
      errors.push(errorMsg);

      if (debug) console.log(errorMsg);
      blacklistPass = false;
    }
  });

  if (!blacklistPass) {
    isValid = false;
  }

  // Strip these whitelisted complete phrases from the title so they don't match later
  whitelist.forEach((whitelistTerm: string) => {
    const regex = RegexParser(`/${whitelistTerm}/gi`);
    title = title.replace(regex, "");
  });

  let titleToCheck = title;
  //strip emoji:
  const emojiReg = new RegExp(RegexParser(emoji_regex), "g");
  titleToCheck = titleToCheck.replace(emojiReg, "");

  //this removes characters that split words
  // currently: \ / - & .. ... ....

  const punctuationToRemoveReg = _toRegExpDoubleBackslash(punctuation_to_strip_regex, "g");
  titleToCheck = titleToCheck.replace(punctuationToRemoveReg, " ");

  // add a space so we can check for whole words at start/end
  titleToCheck = " " + titleToCheck + " ";

  // looking for whole words only. Looking for words with some punctuation like , . ! ( ) *
  // NOTE: / \ - & are removed above.
  // added \d for an auction that said (3lot)
  // add more as needed.
  const expStr = words_to_strip.join("|");
  const punctuationPatternStr = punctuation_pattern_regex;
  const pattern = "\\b" + punctuationPatternStr + "(" + expStr + ")" + punctuationPatternStr + "\\b";
  let matchCount = expStr ? titleToCheck.match(new RegExp(pattern, "gi")) : null;

  if (matchCount !== null) {
    const errorMsg = `Matched with wordsToStrip: ${matchCount.join(",")}.`;
    errors.push(errorMsg);

    if (debug) {
      console.log(errorMsg);
    }
    isValid = false;
  }

  //checking for any field that has a number in it, the above won't work. So the grades will be slightly more strict
  // Examples of issue:
  //  2018 Panini Prizm Luka Doncic Prizm RC PSA 10
  //      was matching PSA 1
  // `Rare Pop 5! Luka Doncic Rookie Card NBA Hoops We Got Next Gem Mint 10 PSA 2018`
  //           was being read as PSA 2.
  const gradeExpStr = grades_to_strip.join("|");
  const gradePunctuationPatternStr = grade_punctuation_pattern_regex;

  const gradePattern =
    "\\b" + gradePunctuationPatternStr + "(" + gradeExpStr + ")" + gradePunctuationPatternStr + "\\b";
  matchCount = gradeExpStr ? titleToCheck.match(new RegExp(gradePattern, "gi")) : null;

  if (matchCount) {
    const errorMsg = `Matched with gradesToStrip: ${matchCount.join(",")}.`;
    errors.push(errorMsg);

    if (debug) {
      console.log(errorMsg);
    }
  }
  isValid = errors.length === 0 && matchCount === null;

  return { isValid, errors };
};

export default passesFilter;
