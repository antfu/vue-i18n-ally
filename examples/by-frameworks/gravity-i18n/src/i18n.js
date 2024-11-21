import {I18N} from '@gravity-ui/i18n';
import { allKeysets } from './i18n-keysets';

const i18nInstance = new I18N();
i18nInstance.registerKeysets('ru', allKeysets.ru);
i18nInstance.registerKeysets('en', allKeysets.en);

export const i18n = i18nInstance.i18n.bind(i18n);
