/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
// eslint-disable-next-line no-use-before-define
import React from 'react'
import { i18n } from './i18n'
import './App.css'

const i18nCommon = i18n.bind(null, 'common')
const i18nHome = i18n.bind(null, 'page.home')

function App() {
  return (
    <div>
      To get started, edit <code>src/App.js</code> and save to reload.
      {i18nCommon('hello')}
      {i18nHome('title')}
      {i18n('page.home', 'title')}
      {i18n('page.main', 'title')}
      {i18n('common', 'hello')}
      {i18nCommon('hello')}
    </div>
  )
}

export default App
