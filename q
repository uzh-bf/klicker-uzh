[1mdiff --git a/src/components/common/ListWithHeader.js b/src/components/common/ListWithHeader.js[m
[1mindex 1f70523..b04775e 100644[m
[1m--- a/src/components/common/ListWithHeader.js[m
[1m+++ b/src/components/common/ListWithHeader.js[m
[36m@@ -12,7 +12,7 @@[m [mconst defaultProps = {[m
 [m
 const ListWithHeader = ({ children, items }) => ([m
   <div>[m
[31m-    <h3 className="listHeader">{children}</h3>[m
[32m+[m[32m    {children && <h3 className="listHeader">{children}</h3> }[m
     <ul className="list">[m
       {items.map(item => ([m
         <li className="listItem" key={item}>[m
[36m@@ -24,7 +24,7 @@[m [mconst ListWithHeader = ({ children, items }) => ([m
     <style jsx>{`[m
       .list {[m
         margin: 0;[m
[31m-        margin-top: 1rem;[m
[32m+[m[32m        // margin-top: 1rem;[m
         padding: 0;[m
       }[m
       .listHeader {[m
[1mdiff --git a/src/components/common/navbar/Navbar.js b/src/components/common/navbar/Navbar.js[m
[1mindex f97035d..a33ddab 100644[m
[1m--- a/src/components/common/navbar/Navbar.js[m
[1m+++ b/src/components/common/navbar/Navbar.js[m
[36m@@ -14,6 +14,7 @@[m [mimport SessionArea from './SessionArea'[m
 [m
 const propTypes = {[m
   accountShort: PropTypes.string,[m
[32m+[m[32m  filters: PropTypes.object,[m
   handleSidebarToggle: PropTypes.func.isRequired,[m
   intl: intlShape.isRequired,[m
   runningSessionId: PropTypes.string,[m
[1mdiff --git a/src/components/common/navbar/SearchArea.js b/src/components/common/navbar/SearchArea.js[m
[1mindex 2f5cbe9..4a711a4 100644[m
[1m--- a/src/components/common/navbar/SearchArea.js[m
[1m+++ b/src/components/common/navbar/SearchArea.js[m
[36m@@ -9,15 +9,37 @@[m [mconst propTypes = {[m
 }[m
 [m
 const SearchArea = ({ intl, handleSearch }) => ([m
[31m-  <Input[m
[31m-    fluid[m
[31m-    icon="search"[m
[31m-    placeholder={intl.formatMessage({[m
[31m-      defaultMessage: 'Search...',[m
[31m-      id: 'common.input.search.placeholder',[m
[31m-    })}[m
[31m-    onChange={e => handleSearch(e.target.value)}[m
[31m-  />[m
[32m+[m[32m  <div className="searchWrapper">[m
[32m+[m[32m    <Input[m
[32m+[m[32m      fluid[m
[32m+[m[32m      icon="search"[m
[32m+[m[32m      placeholder={intl.formatMessage({[m
[32m+[m[32m        defaultMessage: 'Search...',[m
[32m+[m[32m        id: 'common.input.search.placeholder',[m
[32m+[m[32m      })}[m
[32m+[m[32m      onChange={e => handleSearch(e.target.value)}[m
[32m+[m[32m    />[m
[32m+[m[32m    {/* TODO: <div className="filters">[m
[32m+[m[32m      {filters.tags.length > 0 && filters.tags.map(tag => <span className="tag">{tag}</span>)}[m
[32m+[m[32m    </div> */}[m
[32m+[m
[32m+[m[32m    <style jsx>{`[m
[32m+[m[32m      .searchWrapper {[m
[32m+[m[32m        position: relative;[m
[32m+[m
[32m+[m[32m        .filters {[m
[32m+[m[32m          position: absolute;[m
[32m+[m[32m          bottom: 0.65rem;[m
[32m+[m[32m          right: 3rem;[m
[32m+[m
[32m+[m[32m          .tag {[m
[32m+[m[32m            font-style: italic;[m
[32m+[m[32m            margin-left: 0.5rem;[m
[32m+[m[32m          }[m
[32m+[m[32m        }[m
[32m+[m[32m      }[m
[32m+[m[32m    `}</style>[m
[32m+[m[32m  </div>[m
 )[m
 [m
 SearchArea.propTypes = propTypes[m
[1mdiff --git a/src/components/questions/Question.js b/src/components/questions/Question.js[m
[1mindex c878cc1..bc3e5de 100644[m
[1m--- a/src/components/questions/Question.js[m
[1m+++ b/src/components/questions/Question.js[m
[36m@@ -81,7 +81,12 @@[m [mconst Question = ({[m
         </div>[m
 [m
         <div className="details">[m
[31m-          <QuestionDetails description={description} lastUsed={lastUsed} questionId={id} />[m
[32m+[m[32m          <QuestionDetails[m
[32m+[m[32m            description={description}[m
[32m+[m[32m            lastUsed={lastUsed}[m
[32m+[m[32m            questionId={id}[m
[32m+[m[32m            questionType={type}[m
[32m+[m[32m          />[m
         </div>[m
       </div>[m
 [m
[36m@@ -92,7 +97,7 @@[m [mconst Question = ({[m
           display: flex;[m
           flex-flow: column nowrap;[m
 [m
[31m-          padding: 10px;[m
[32m+[m[32m          padding: 0.5rem;[m
           border: 1px solid lightgray;[m
           background-color: #f9f9f9;[m
 [m
[36m@@ -146,18 +151,19 @@[m [mconst Question = ({[m
               flex: 1;[m
               flex-flow: row wrap;[m
 [m
[31m-              .title,[m
[31m-              .versionChooser {[m
[32m+[m[32m              .title {[m
                 flex: 0 0 auto;[m
               }[m
 [m
               .versionChooser {[m
[31m-                padding-top: 2px;[m
[31m-                padding-left: 1rem;[m
[32m+[m[32m                flex: 1 1 auto;[m
[32m+[m[32m                padding-right: 1rem;[m
[32m+[m[32m                text-align: right;[m
[32m+[m[32m                align-self: center;[m
               }[m
 [m
               .tags {[m
[31m-                flex: 1 1 auto;[m
[32m+[m[32m                flex: 0 0 auto;[m
                 align-self: flex-end;[m
               }[m
 [m
[1mdiff --git a/src/components/questions/QuestionDetails.js b/src/components/questions/QuestionDetails.js[m
[1mindex 63eed05..57b0288 100644[m
[1m--- a/src/components/questions/QuestionDetails.js[m
[1m+++ b/src/components/questions/QuestionDetails.js[m
[36m@@ -3,7 +3,6 @@[m [mimport PropTypes from 'prop-types'[m
 import _truncate from 'lodash/truncate'[m
 import Link from 'next/link'[m
 [m
[31m-import { FormattedMessage } from 'react-intl'[m
 import { Button } from 'semantic-ui-react'[m
 [m
 import { ListWithHeader } from '../common'[m
[36m@@ -25,19 +24,11 @@[m [mconst QuestionDetails = ({ questionId, description, lastUsed }) => {[m
   return ([m
     <div className="questionDetails">[m
       <div className="column description">{truncatedDesc}</div>[m
[31m-      <div className="column col2">[m
[31m-        <p>[m
[31m-          Antworten Total: <strong>999</strong>[m
[31m-        </p>[m
[31m-        <p>[m
[31m-          Korrekte Antworten: <strong>88%</strong>[m
[31m-        </p>[m
[31m-      </div>[m
 [m
[31m-      <div className="column col3">[m
[31m-        <ListWithHeader items={lastUsed.length > 0 ? lastUsed : ['Never used']}>[m
[31m-          <FormattedMessage defaultMessage="Last used" id="questionPool.question.lastUsed" />[m
[31m-        </ListWithHeader>[m
[32m+[m[32m      <div className="column options" />[m
[32m+[m
[32m+[m[32m      <div className="column lastUsed">[m
[32m+[m[32m        <ListWithHeader items={lastUsed.length > 0 ? lastUsed : ['-']} />[m
       </div>[m
 [m
       <div className="column buttons">[m
[36m@@ -70,12 +61,12 @@[m [mconst QuestionDetails = ({ questionId, description, lastUsed }) => {[m
             background-color: $color-primary-background;[m
           }[m
 [m
[31m-          .col2 {[m
[32m+[m[32m          .options {[m
             display: none;[m
             border-bottom: 1px solid $color-primary;[m
           }[m
 [m
[31m-          .col3 {[m
[32m+[m[32m          .lastUsed {[m
             display: none;[m
             border-bottom: 1px solid $color-primary;[m
           }[m
[36m@@ -99,7 +90,7 @@[m [mconst QuestionDetails = ({ questionId, description, lastUsed }) => {[m
 [m
             .column {[m
               flex: 1;[m
[31m-              padding: 1rem;[m
[32m+[m[32m              padding: 0.7rem;[m
               text-align: left;[m
 [m
               &:not(:last-child) {[m
[36m@@ -111,14 +102,14 @@[m [mconst QuestionDetails = ({ questionId, description, lastUsed }) => {[m
               border-bottom: none;[m
             }[m
 [m
[31m-            .col2 {[m
[31m-              /* display: block; */[m
[32m+[m[32m            .options {[m
               border-bottom: none;[m
             }[m
 [m
[31m-            .col3 {[m
[32m+[m[32m            .lastUsed {[m
               display: block;[m
               border-bottom: none;[m
[32m+[m[32m              text-align: center;[m
             }[m
 [m
             .buttons {[m
[36m@@ -145,12 +136,12 @@[m [mconst QuestionDetails = ({ questionId, description, lastUsed }) => {[m
           }[m
 [m
           @include desktop-only {[m
[31m-            .col2 {[m
[31m-              flex: 0 0 250px;[m
[32m+[m[32m            .options {[m
[32m+[m[32m              flex: 0 0 10rem;[m
             }[m
 [m
[31m-            .col3 {[m
[31m-              flex: 0 0 250px;[m
[32m+[m[32m            .lastUsed {[m
[32m+[m[32m              flex: 0 0 auto;[m
             }[m
           }[m
         }[m
[1mdiff --git a/src/components/questions/QuestionList.js b/src/components/questions/QuestionList.js[m
[1mindex 8569dd5..f5ebfa5 100644[m
[1m--- a/src/components/questions/QuestionList.js[m
[1m+++ b/src/components/questions/QuestionList.js[m
[36m@@ -59,7 +59,7 @@[m [mexport const QuestionListPres = ({[m
     <style jsx>{`[m
       .questionList {[m
         :global(> *) {[m
[31m-          margin-bottom: 1rem;[m
[32m+[m[32m          margin-bottom: 1.5rem;[m
         }[m
 [m
         .message {[m
[1mdiff --git a/src/components/questions/TagList.js b/src/components/questions/TagList.js[m
[1mindex af7793a..eed4c80 100644[m
[1m--- a/src/components/questions/TagList.js[m
[1m+++ b/src/components/questions/TagList.js[m
[36m@@ -22,7 +22,7 @@[m [mconst defaultProps = {[m
   tags: [],[m
 }[m
 [m
[31m-export const TagListPres = ({ tags, handleTagClick }) => ([m
[32m+[m[32mexport const TagListPres = ({ tags, types, handleTagClick }) => ([m
   <div className="tagList">[m
     {tags.length === 0 ? ([m
       <FormattedMessage defaultMessage="No tags available." id="tagList.string.noTags" />[m
[36m@@ -30,6 +30,18 @@[m [mexport const TagListPres = ({ tags, handleTagClick }) => ([m
       [][m
     )}[m
     <List selection size="large">[m
[32m+[m[32m      {types.map(({ isActive, name }) => ([m
[32m+[m[32m        <List.Item[m
[32m+[m[32m          active={isActive}[m
[32m+[m[32m          className="listItem"[m
[32m+[m[32m          key="type"[m
[32m+[m[32m          onClick={() => handleTagClick(name, true)}[m
[32m+[m[32m        >[m
[32m+[m[32m          <List.Icon name={isActive ? 'folder' : 'folder outline'} />[m
[32m+[m[32m          <List.Content>{name}</List.Content>[m
[32m+[m[32m        </List.Item>[m
[32m+[m[32m      ))}[m
[32m+[m[32m      <List.Divider />[m
       {tags.map(({ isActive, id, name }) => ([m
         <List.Item[m
           active={isActive}[m
[36m@@ -67,8 +79,12 @@[m [mexport default compose([m
   graphql(TagListQuery),[m
   branch(({ data }) => data.loading, renderComponent(LoadingDiv)),[m
   branch(({ data }) => data.error, renderComponent(({ data }) => <div>{data.error}</div>)),[m
[31m-  withProps(({ activeTags, data: { loading, tags } }) => ({[m
[32m+[m[32m  withProps(({ activeTags, activeTypes, data: { loading, tags } }) => ({[m
     loading,[m
     tags: tags && tags.map(tag => ({ ...tag, isActive: activeTags.includes(tag.name) })),[m
[32m+[m[32m    types: ['SC', 'MC', 'FREE', 'FREE_RANGE'].map(type => ({[m
[32m+[m[32m      isActive: activeTypes.includes(type),[m
[32m+[m[32m      name: type,[m
[32m+[m[32m    })),[m
   })),[m
 )(TagListPres)[m
[1mdiff --git a/src/lib/utils/filters.js b/src/lib/utils/filters.js[m
[1mindex 0ac0b3c..a489080 100644[m
[1m--- a/src/lib/utils/filters.js[m
[1m+++ b/src/lib/utils/filters.js[m
[36m@@ -4,7 +4,10 @@[m [mimport _every from 'lodash/every'[m
 [m
 function filterQuestions(questions, filters) {[m
   return questions.filter((question) => {[m
[31m-    if (filters.title && !question.title.includes(filters.title)) {[m
[32m+[m[32m    if (filters.type && question.type !== filters.type) {[m
[32m+[m[32m      return false[m
[32m+[m[32m    }[m
[32m+[m[32m    if (filters.title && !question.title.toLowerCase().includes(filters.title.toLowerCase())) {[m
       return false[m
     }[m
     if ([m
[36m@@ -13,9 +16,6 @@[m [mfunction filterQuestions(questions, filters) {[m
     ) {[m
       return false[m
     }[m
[31m-    if (filters.type && question.type !== filters.type) {[m
[31m-      return false[m
[31m-    }[m
     return true[m
   })[m
 }[m
[1mdiff --git a/src/pages/questions/index.js b/src/pages/questions/index.js[m
[1mindex 4b213df..16bc14d 100644[m
[1m--- a/src/pages/questions/index.js[m
[1m+++ b/src/pages/questions/index.js[m
[36m@@ -96,7 +96,11 @@[m [mconst Index = ({[m
     >[m
       <div className="questionPool">[m
         <div className="tagList">[m
[31m-          <TagList activeTags={filters.tags} handleTagClick={handleTagClick} />[m
[32m+[m[32m          <TagList[m
[32m+[m[32m            activeTags={filters.tags}[m
[32m+[m[32m            handleTagClick={handleTagClick}[m
[32m+[m[32m            activeTypes={filters.types}[m
[32m+[m[32m          />[m
         </div>[m
         <div className="wrapper">[m
           <div className="questionList">[m
[36m@@ -206,7 +210,7 @@[m [mexport default compose([m
   withState('filters', 'setFilters', {[m
     tags: [],[m
     title: null,[m
[31m-    type: null,[m
[32m+[m[32m    types: [],[m
   }),[m
   withHandlers({[m
     // handle toggling creation mode (display of session creation form)[m
[36m@@ -233,8 +237,19 @@[m [mexport default compose([m
     },[m
 [m
     // handle clicking on a tag in the tag list[m
[31m-    handleTagClick: ({ setFilters }) => tagName =>[m
[32m+[m[32m    handleTagClick: ({ setFilters }) => (tagName, questionType = false) =>[m
       setFilters((prevState) => {[m
[32m+[m[32m        // if the changed tag is a question type tag[m
[32m+[m[32m        if (questionType) {[m
[32m+[m[32m          // remove the tag from active tags[m
[32m+[m[32m          if (prevState.types.includes(tagName)) {[m
[32m+[m[32m            return { ...prevState, types: prevState.types.filter(tag => tag !== tagName) }[m
[32m+[m[32m          }[m
[32m+[m
[32m+[m[32m          // add the tag to active tags[m
[32m+[m[32m          return { ...prevState, types: [...prevState.types, tagName] }[m
[32m+[m[32m        }[m
[32m+[m
         // remove the tag from active tags[m
         if (prevState.tags.includes(tagName)) {[m
           return {[m
