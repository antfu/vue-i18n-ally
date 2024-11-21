<template lang="pug">
.review-comment
  .viewing(v-if='!editing')
    avatar(:user='comment.user')
    .panel.shadow.comment-content
      template
        v-check.state-icon(v-if='comment.type==="approve"')
        v-plus-minus.state-icon(v-else-if='comment.type==="request_change"')
        v-comment-outline.state-icon(v-else)

      .text(:class='{placeholder: !comment.comment}') {{comment.comment || placeholders[comment.type]}}

      .buttons
        .button.flat(@click='editing = true' v-if='isEditable')
          v-pencil
          span {{ $t('review.edit') }}

        .button.approve.flat(@click='resolveComment(comment)')
          v-checkbox-marked-outline
          span {{ $t('review.resolve') }}

    template(v-if='!readonly && comment.suggestion')
      div
      .panel.shadow.comment-content
        v-format-quote-open.state-icon
        .text {{comment.suggestion}}
        .buttons
          .button.flat(@click='acceptSuggestion(comment)') {{$t('review.accept_suggestion')}}

  .editing(v-else)
    avatar(:user='$store.state.config.user')
    .panel.comment-form
      label {{$t('review.comment')}}
      .panel
        textarea(
          rows='1'
          ref='textarea2'
          :placeholder='$t("review.optional")'
          v-model='form.comment'
        )

      template(v-if='!readonly')
        label {{$t('review.suggestion')}}
        .panel
          textarea(
            rows='1'
            ref='textarea3'
            :placeholder='$t("review.optional")'
            v-model='form.suggestion'
          )

      .buttons
        .button.approve(@click='postComment("approve")' :disabled='!!form.suggestion')
          v-check
          span {{$t('review.approve')}}
        .button.request-change(@click='postComment("request_change")')
          v-plus-minus
          span {{$t('review.request_change')}}
        .button.comment(@click='postComment("comment")' :disabled='!form.comment')
          v-comment-outline
          span {{$t('review.leave_comment')}}
        .button(@click='cancel()') {{ $t('prompt.button_cancel') }}
</template>

<script lang="js">
import Vue from 'vue'
import cloneDeep from 'lodash/cloneDeep'
import Avatar from './Avatar.vue'
import { vscode } from './api'

export default Vue.extend({
  components: {
    Avatar,
  },

  props: {
    editing: { type: Boolean, default: false },
    mode: { type: String, default: 'edit' },
    comment: { type: Object, default: () => ({ comment: '', suggestion: '' }) },
    record: { type: Object, default: () => ({ keypath: '', locale: '' }) },
  },

  emits: ['done'],

  data() {
    return {
      form: {
        comment: '',
        suggestion: '',
      },
    }
  },

  computed: {
    placeholders() {
      return {
        approve: this.$t('review.placeholder.approve'),
        request_change: this.$t('review.placeholder.request_change'),
        comment: this.$t('review.placeholder.comment'),
      }
    },
    isEditable() {
      return this.comment.user?.email === this.$store.state.config.user?.email
    },
  },

  watch: {
    editing: {
      immidate: true,
      handler() {
        if (this.editing)
          this.resetForm()
      },
    },
    form: {
      deep: true,
      handler() {
        this.$nextTick(() => {
          this.resize(this.$refs?.textarea2)
          this.resize(this.$refs?.textarea3)
        })
      },
    },
  },

  methods: {
    resetForm() {
      this.form = cloneDeep(this.comment)
    },
    resize(ta) {
      if (!ta)
        return

      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight - 3}px`
    },
    cancel() {
      // eslint-disable-next-line vue/no-mutating-props
      this.editing = false
      this.$emit('done')
    },
    postComment(type) {
      vscode.postMessage({
        type: this.mode === 'create' ? 'review.comment' : 'review.edit',
        keypath: this.record.keypath,
        locale: this.record.locale,
        data: {
          ...this.form,
          type,
        },
      })
      // eslint-disable-next-line vue/no-mutating-props
      this.editing = false
      this.$emit('done')
    },
    resolveComment(comment) {
      vscode.postMessage({
        type: 'review.resolve',
        keypath: this.record.keypath,
        locale: this.record.locale,
        commentId: comment.id,
      })
    },
    acceptSuggestion(comment) {
      vscode.postMessage({
        type: 'review.apply-suggestion',
        keypath: this.record.keypath,
        locale: this.record.locale,
        commentId: comment.id,
      })
    },
  },
})
</script>

<style lang="stylus">
.review-comment
  .viewing, .editing
    display grid
    grid-template-columns max-content auto

    & > .avatar
      margin 0.6em 0.4em 0 1.2em

  .comment-content
    display grid
    grid-template-columns min-content auto max-content max-content
    margin-top 0.4em

    .text
      margin auto 6px
      font-size 0.8em

      &.placeholder
        font-style italic
        opacity 0.4

    .buttons
      .button
        margin-top 0
        margin-bottom 0
</style>
