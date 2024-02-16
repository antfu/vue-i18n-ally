import axios from "axios";
import TranslateEngine, { TranslateOptions, TranslateResult } from "./base";
import { Config } from "~/core";

export default class OpenAITranslate extends TranslateEngine {
  apiRoot = "https://api.openai.com";
  systemPrompt = 'You are a professional translation engine. Please translate text. Text inside "{{}}" or "{}" are variable substitutions and should be kept intact but they can be moved around if necessary and the variable name can be used for additional context. Text inside "$t()" are translation substitutions and must be kept as is but they can be moved around if necessary.';

  async translate(options: TranslateOptions) {
    let apiKey = Config.openaiApiKey;
    let apiRoot = this.apiRoot;
    if (Config.openaiApiRoot) apiRoot = Config.openaiApiRoot.replace(/\/$/, "");
    let model = Config.openaiApiModel;

    const response = await axios.post(
      `${apiRoot}/v1/chat/completions`,
      {
        model,
        temperature: 0,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 1,
        presence_penalty: 1,
        messages: [
          {
            role: "system",
            content: this.systemPrompt,
          },
          {
            role: "user",
            content: this.generateUserPrompts(options),
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return this.transform(response, options);
  }

  transform(response: any, options: TranslateOptions): TranslateResult {
    const { text, from = "auto", to = "auto" } = options;

    const translatedText = response.data.choices[0].message.content?.trim();

    const r: TranslateResult = {
      text,
      to,
      from,
      response,
      result: translatedText ? [translatedText] : undefined,
      linkToResult: "",
    };


    return r;
  }

  generateUserPrompts(options: TranslateOptions): string {
    const sourceLang = options.from;
    const targetLang = options.to;

    let generatedUserPrompt = `translate from ${sourceLang} to ${targetLang}:\n\n${options.text}`;

    return generatedUserPrompt;
  }
}
