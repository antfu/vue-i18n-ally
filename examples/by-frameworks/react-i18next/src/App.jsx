/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { Component } from 'react'
import { useTranslation, withTranslation, Trans } from 'react-i18next'
import './App.css'

// use hoc for class based components
class LegacyWelcomeClass extends Component {
  render() {
    const { t } = this.props
    return (
      <div>
        <h2>Plain Text</h2>
        <h2>{t('translation.title')}</h2>
      </div>
    )
  }
}
const Welcome = withTranslation()(LegacyWelcomeClass)

// Component using the Trans component
function MyComponent() {
  return (
    <Trans i18nKey="translation:description.part1">
      To get started, edit <code>src/App.js</code> and save to reload.
    </Trans>
  )
}

// page uses the hook
function Page() {
  const { t, i18n } = useTranslation()

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div className="App">
      <div className="App-header">
        <Welcome />
        <button onClick={() => changeLanguage('de')}>de</button>
        <button onClick={() => changeLanguage('en')}>en</button>
      </div>
      <div className="App-intro">
        <MyComponent />
      </div>
      <div>{t('translation.description.part2')}</div>
      {/* plain <Trans>, #423 */}
      <Trans i18nKey="translation.description.part2">Fallback text</Trans>
    </div>
  )
}

// hook with scope
function Page2() {
  const { t } = useTranslation(['translation.foo'])

  // inside default namespace ("foo.bar")
  t('bar')

  // explicit namespace
  t('pages.home:title')
  t('pages/home:title')
}

// hook with another scope
function Page3() {
  const { t } = useTranslation('pages/home')

  t('title')

  // explicit namespace
  t('translation:title')
}

// hook with scope in options
function Page4() {
  const { t } = useTranslation('pages/home')

  t('title')

  // explicit namespace
  t('title', { ns: 'translation' })
}


// component with scope in props
function Page5() {
  const { t } = useTranslation('pages/home');

  return (
    <div className="App">
      <Trans t={t} i18nKey="title"></Trans>
      {/* explicit namespace */}
      <Trans t={t} i18nKey="title" ns="translation"></Trans>
    </div>
  )
}

function KeyPrefix() {
  const { t } = useTranslation('pages/home', { keyPrefix: 'description' });

  t('part1')
}