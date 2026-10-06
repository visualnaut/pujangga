# Changelog

## [1.2.0](https://github.com/visualnaut/pujangga/compare/v1.1.0...v1.2.0) (2026-10-06)


### Features

* add bubble menu, snackbars for lock & note deletion guard, and formatting immutability ([3eaab5b](https://github.com/visualnaut/pujangga/commit/3eaab5b6754f9f7ac07ee5ee62ab91b56c786dd2))
* add contextual anchoring for locked text and fix mark boundary typing inheritance ([ee0763a](https://github.com/visualnaut/pujangga/commit/ee0763a4d8609cda82fcbe648ab43d8c302daaab))
* add Locked Text drawer, formatting toolbar, zen mode, and green lock highlights ([014ecc1](https://github.com/visualnaut/pujangga/commit/014ecc1375034f08e4d494401752a111bcfff9cd))
* add persistent text locking across revision rounds with immutability directive ([17fac1d](https://github.com/visualnaut/pujangga/commit/17fac1d68f9dbc27834041355ec9e95184317624))
* adopt #F6F5F2 light paper theme and enforce revision request validation ([7aa82d5](https://github.com/visualnaut/pujangga/commit/7aa82d5d3e4eeb319bf6e183baf9e23576db35e4))
* **audio:** add Web Audio engine with curated mechanical switch sound assets ([725b4ee](https://github.com/visualnaut/pujangga/commit/725b4ee467699620ca82795e93fa6a5fd7de225a))
* **branding:** add logo image, set favicon, and establish vibrant #FF4F00 accent & [#02875](https://github.com/visualnaut/pujangga/issues/02875)A success palettes ([81bb6c1](https://github.com/visualnaut/pujangga/commit/81bb6c1e30e709232322b9134875dc1133c6d3c9))
* **cli:** add pujangga reset command with interactive confirmation prompt ([e95f46d](https://github.com/visualnaut/pujangga/commit/e95f46db3dce5a932840cb1776e08a3ab9eead6b))
* confirm modal before finalize, clear comments/history on approval, and reliable browser auto-open ([c5f8b81](https://github.com/visualnaut/pujangga/commit/c5f8b812c8e0e0d55a9438bd63a5a66445c5b7c7))
* **diff:** floating full-width side-by-side diff with live editing, notes, synced scroll toggle, and round exclusion ([7e44667](https://github.com/visualnaut/pujangga/commit/7e4466780965fcc620894bf13538aa4efa1a1514))
* **editor:** persist inline comment highlight marks and render pin markers ([b92c38e](https://github.com/visualnaut/pujangga/commit/b92c38ef37f567f57070e2c21011d13cf89ea82e))
* initial commit of Pujangga review skill and web surface ([03467e0](https://github.com/visualnaut/pujangga/commit/03467e0e800a53362e641dd43c0752cab29fd334))
* make skill zero-build ready for npx skills add, add responsive desktop sidebar and fix dark mode contrast ([95a77fe](https://github.com/visualnaut/pujangga/commit/95a77fe80f93f0003ad0b4e90c603174e63a483d))
* replace audit with Comment History and add Side-by-Side Synced Scroll Diff with flexible round selector ([d3865b6](https://github.com/visualnaut/pujangga/commit/d3865b622cfa62fd5e58dc474960d532fec48f89))
* **ui:** add 50% black backdrop overlay in Hemingway Mode with editor on top ([e01cd5d](https://github.com/visualnaut/pujangga/commit/e01cd5d8b7db89e5ab503f42dd8041a7f825c753))
* **ui:** add enter/exit animation and 3s auto-exit to floating alert banner, remove contextual inline warnings ([1962d7c](https://github.com/visualnaut/pujangga/commit/1962d7c37e0ba8affaa1bcbd16ce7c24735d6de6))
* **ui:** add floating exit zen mode button at bottom center and block clicks behind overlay ([5a5a6ad](https://github.com/visualnaut/pujangga/commit/5a5a6adf9f3a4efa1ae54187687ec5a15607bb2c))
* **ui:** add Hemingway Mode with 50% opacity fade and 2x longer transition duration ([975c097](https://github.com/visualnaut/pujangga/commit/975c09782e2329e97e23ec102adeb700183fd5b7))
* **ui:** add live sidebar word count & reading duration, simplify lock popover ([1ab3110](https://github.com/visualnaut/pujangga/commit/1ab3110a91ead0dfed55f18f190208cc7b5f5400))
* **ui:** add tactile paper noise texture to editor canvas ([47c11ce](https://github.com/visualnaut/pujangga/commit/47c11ce2a1e021c5c37740ab8e12d9821a887fe4))
* **ui:** add unified Settings popover with theme toggle and live sound preview ([5b4a84a](https://github.com/visualnaut/pujangga/commit/5b4a84a74c46312b5c0d715691c773b5f8622c60))
* **ui:** delay overlay fade-in until sidebar collapse completes and restore navbar directly on exit ([244a113](https://github.com/visualnaut/pujangga/commit/244a1132614078e2b4cbf04828c9ab1d9eb23407))
* **ui:** eliminate navbar exit flash and add 3-minute 50% to 90% overlay deepening transition ([e5464df](https://github.com/visualnaut/pujangga/commit/e5464df3dc9548a27b8a05c3afc047fe117790ec))
* **ui:** hide navbar comment history button on desktop view ([e1ddf2f](https://github.com/visualnaut/pujangga/commit/e1ddf2f741d2bba2d1dc3ebb4f9f68664f078836))
* **ui:** remove revising pill from top bar, remove satisfied from diff header, and add directive popover to request revision ([9371641](https://github.com/visualnaut/pujangga/commit/9371641e3e734fe14321a119db4b55907db3173f))
* **ui:** set 14px minimum font size floor and add enter/exit animations for modals and drawers ([d723308](https://github.com/visualnaut/pujangga/commit/d723308ec7da7c4c9c4337f590ca8ee12d06ece8))
* **ui:** update bubble menu for light mode and add contextual colors to snackbar ([4fecf5f](https://github.com/visualnaut/pujangga/commit/4fecf5f3da08db58e52879020c7530a1f41ebf5e))
* **zen:** integrate tactile key sounds and floating mute toggle with Alt+M shortcut in Ananta Toer Mode ([696fda1](https://github.com/visualnaut/pujangga/commit/696fda1f3fc0494aef0f1d2f97b757a31b66a559))


### Bug Fixes

* **ci:** upgrade npm to latest for oidc trusted publishing and add workflow_dispatch ([#4](https://github.com/visualnaut/pujangga/issues/4)) ([fb6bc96](https://github.com/visualnaut/pujangga/commit/fb6bc96916a204275fc8b6661849927991dfac75))
* **css:** remove duplicate border and background on code elements inside pre codeblocks ([6fe6451](https://github.com/visualnaut/pujangga/commit/6fe64519c18cdebee786847eddfa0ca4b14a44f7))
* **editor:** exclude text locking and note operations from undo/redo history stack ([b212ef7](https://github.com/visualnaut/pujangga/commit/b212ef7d0a19d79eca44383f7ed962a2a2f05df6))
* remove top bar ready status and direct edit badges, implement robust text locking and comment mark removal ([a3c523c](https://github.com/visualnaut/pujangga/commit/a3c523ca3f760ebd86b955c95e0e9e84bd1efaf6))
* **settings:** clear live sound preview text when settings popover is closed ([c4e3887](https://github.com/visualnaut/pujangga/commit/c4e388784b151ac95e506b6d82a2bf7c2f61ef88))
* **ui:** close comment history sidebar when clicking outside ([b6890ef](https://github.com/visualnaut/pujangga/commit/b6890ef23a838092a1449362b5e42713af972aa4))
* **ui:** ensure comment history sidebar enter animation always triggers and remove backdrop blur ([358987a](https://github.com/visualnaut/pujangga/commit/358987a947615cf62b094a4d280a055ec72c2442))
* **ui:** move navbar bottom border inside header under dimming veil in zen mode ([7eed5df](https://github.com/visualnaut/pujangga/commit/7eed5df1447b5cedc437f6790e5d5dd126bcf3ac))
* **ui:** prevent overlay exit transition on initial page mount ([bcc9695](https://github.com/visualnaut/pujangga/commit/bcc96950ddda881c7e219d64c483cd47a8750bc4))

## [1.1.0](https://github.com/visualnaut/pujangga/compare/pujangga-v1.0.1...pujangga-v1.1.0) (2026-10-06)


### Features

* add bubble menu, snackbars for lock & note deletion guard, and formatting immutability ([3eaab5b](https://github.com/visualnaut/pujangga/commit/3eaab5b6754f9f7ac07ee5ee62ab91b56c786dd2))
* add contextual anchoring for locked text and fix mark boundary typing inheritance ([ee0763a](https://github.com/visualnaut/pujangga/commit/ee0763a4d8609cda82fcbe648ab43d8c302daaab))
* add Locked Text drawer, formatting toolbar, zen mode, and green lock highlights ([014ecc1](https://github.com/visualnaut/pujangga/commit/014ecc1375034f08e4d494401752a111bcfff9cd))
* add persistent text locking across revision rounds with immutability directive ([17fac1d](https://github.com/visualnaut/pujangga/commit/17fac1d68f9dbc27834041355ec9e95184317624))
* adopt #F6F5F2 light paper theme and enforce revision request validation ([7aa82d5](https://github.com/visualnaut/pujangga/commit/7aa82d5d3e4eeb319bf6e183baf9e23576db35e4))
* **audio:** add Web Audio engine with curated mechanical switch sound assets ([725b4ee](https://github.com/visualnaut/pujangga/commit/725b4ee467699620ca82795e93fa6a5fd7de225a))
* **branding:** add logo image, set favicon, and establish vibrant #FF4F00 accent & [#02875](https://github.com/visualnaut/pujangga/issues/02875)A success palettes ([81bb6c1](https://github.com/visualnaut/pujangga/commit/81bb6c1e30e709232322b9134875dc1133c6d3c9))
* **cli:** add pujangga reset command with interactive confirmation prompt ([e95f46d](https://github.com/visualnaut/pujangga/commit/e95f46db3dce5a932840cb1776e08a3ab9eead6b))
* confirm modal before finalize, clear comments/history on approval, and reliable browser auto-open ([c5f8b81](https://github.com/visualnaut/pujangga/commit/c5f8b812c8e0e0d55a9438bd63a5a66445c5b7c7))
* **diff:** floating full-width side-by-side diff with live editing, notes, synced scroll toggle, and round exclusion ([7e44667](https://github.com/visualnaut/pujangga/commit/7e4466780965fcc620894bf13538aa4efa1a1514))
* **editor:** persist inline comment highlight marks and render pin markers ([b92c38e](https://github.com/visualnaut/pujangga/commit/b92c38ef37f567f57070e2c21011d13cf89ea82e))
* initial commit of Pujangga review skill and web surface ([03467e0](https://github.com/visualnaut/pujangga/commit/03467e0e800a53362e641dd43c0752cab29fd334))
* make skill zero-build ready for npx skills add, add responsive desktop sidebar and fix dark mode contrast ([95a77fe](https://github.com/visualnaut/pujangga/commit/95a77fe80f93f0003ad0b4e90c603174e63a483d))
* replace audit with Comment History and add Side-by-Side Synced Scroll Diff with flexible round selector ([d3865b6](https://github.com/visualnaut/pujangga/commit/d3865b622cfa62fd5e58dc474960d532fec48f89))
* **ui:** add 50% black backdrop overlay in Hemingway Mode with editor on top ([e01cd5d](https://github.com/visualnaut/pujangga/commit/e01cd5d8b7db89e5ab503f42dd8041a7f825c753))
* **ui:** add enter/exit animation and 3s auto-exit to floating alert banner, remove contextual inline warnings ([1962d7c](https://github.com/visualnaut/pujangga/commit/1962d7c37e0ba8affaa1bcbd16ce7c24735d6de6))
* **ui:** add floating exit zen mode button at bottom center and block clicks behind overlay ([5a5a6ad](https://github.com/visualnaut/pujangga/commit/5a5a6adf9f3a4efa1ae54187687ec5a15607bb2c))
* **ui:** add Hemingway Mode with 50% opacity fade and 2x longer transition duration ([975c097](https://github.com/visualnaut/pujangga/commit/975c09782e2329e97e23ec102adeb700183fd5b7))
* **ui:** add live sidebar word count & reading duration, simplify lock popover ([1ab3110](https://github.com/visualnaut/pujangga/commit/1ab3110a91ead0dfed55f18f190208cc7b5f5400))
* **ui:** add tactile paper noise texture to editor canvas ([47c11ce](https://github.com/visualnaut/pujangga/commit/47c11ce2a1e021c5c37740ab8e12d9821a887fe4))
* **ui:** add unified Settings popover with theme toggle and live sound preview ([5b4a84a](https://github.com/visualnaut/pujangga/commit/5b4a84a74c46312b5c0d715691c773b5f8622c60))
* **ui:** delay overlay fade-in until sidebar collapse completes and restore navbar directly on exit ([244a113](https://github.com/visualnaut/pujangga/commit/244a1132614078e2b4cbf04828c9ab1d9eb23407))
* **ui:** eliminate navbar exit flash and add 3-minute 50% to 90% overlay deepening transition ([e5464df](https://github.com/visualnaut/pujangga/commit/e5464df3dc9548a27b8a05c3afc047fe117790ec))
* **ui:** hide navbar comment history button on desktop view ([e1ddf2f](https://github.com/visualnaut/pujangga/commit/e1ddf2f741d2bba2d1dc3ebb4f9f68664f078836))
* **ui:** remove revising pill from top bar, remove satisfied from diff header, and add directive popover to request revision ([9371641](https://github.com/visualnaut/pujangga/commit/9371641e3e734fe14321a119db4b55907db3173f))
* **ui:** set 14px minimum font size floor and add enter/exit animations for modals and drawers ([d723308](https://github.com/visualnaut/pujangga/commit/d723308ec7da7c4c9c4337f590ca8ee12d06ece8))
* **ui:** update bubble menu for light mode and add contextual colors to snackbar ([4fecf5f](https://github.com/visualnaut/pujangga/commit/4fecf5f3da08db58e52879020c7530a1f41ebf5e))
* **zen:** integrate tactile key sounds and floating mute toggle with Alt+M shortcut in Ananta Toer Mode ([696fda1](https://github.com/visualnaut/pujangga/commit/696fda1f3fc0494aef0f1d2f97b757a31b66a559))


### Bug Fixes

* **css:** remove duplicate border and background on code elements inside pre codeblocks ([6fe6451](https://github.com/visualnaut/pujangga/commit/6fe64519c18cdebee786847eddfa0ca4b14a44f7))
* **editor:** exclude text locking and note operations from undo/redo history stack ([b212ef7](https://github.com/visualnaut/pujangga/commit/b212ef7d0a19d79eca44383f7ed962a2a2f05df6))
* remove top bar ready status and direct edit badges, implement robust text locking and comment mark removal ([a3c523c](https://github.com/visualnaut/pujangga/commit/a3c523ca3f760ebd86b955c95e0e9e84bd1efaf6))
* **settings:** clear live sound preview text when settings popover is closed ([c4e3887](https://github.com/visualnaut/pujangga/commit/c4e388784b151ac95e506b6d82a2bf7c2f61ef88))
* **ui:** close comment history sidebar when clicking outside ([b6890ef](https://github.com/visualnaut/pujangga/commit/b6890ef23a838092a1449362b5e42713af972aa4))
* **ui:** ensure comment history sidebar enter animation always triggers and remove backdrop blur ([358987a](https://github.com/visualnaut/pujangga/commit/358987a947615cf62b094a4d280a055ec72c2442))
* **ui:** move navbar bottom border inside header under dimming veil in zen mode ([7eed5df](https://github.com/visualnaut/pujangga/commit/7eed5df1447b5cedc437f6790e5d5dd126bcf3ac))
* **ui:** prevent overlay exit transition on initial page mount ([bcc9695](https://github.com/visualnaut/pujangga/commit/bcc96950ddda881c7e219d64c483cd47a8750bc4))
