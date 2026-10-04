// Source-checked guides suitable for publication. External claims cite primary
// or authoritative sources; ChatHere-specific statements are checked against
// the application repository.
module.exports = [
  {
    slug: 'online-privacy-checklist-anonymous-browsing',
    title: 'A Practical Online Privacy Checklist for Chatting with Strangers',
    metaDescription: 'A practical checklist for protecting personal information in online chats, based on guidance from the FTC and CISA.',
    date: '2026-10-04',
    author: 'ChatHere Editorial Desk',
    category: 'Online privacy',
    excerpt: 'Simple steps for limiting what you reveal in public chats, spotting suspicious requests, and understanding what anonymity does not protect.',
    sections: [
      { heading: 'Treat a screen name as a label, not a shield', content: 'A pseudonym can separate a conversation from your everyday identity, but it does not make information you share harmless. Avoid posting passwords, account recovery codes, financial details, your home address, or combinations of details that identify you. The FTC advises people to be careful about sharing personal information with people they meet online.', sources: [0] },
      { heading: 'Pause before following links or requests', content: 'A stranger may misrepresent who they are or send a message designed to make you act quickly. Don’t provide personal information in response to an unexpected request. Verify a request through a separate, trusted channel before acting on it. CISA’s basic online safety guidance also recommends recognizing and reporting phishing.', sources: [1, 2] },
      { heading: 'Check the service, not just the chat', content: 'Before using a chat service, read its privacy information and check what data it collects, why it uses that data, and how long it retains it. A service that does not require an account may reduce the information you submit during signup; that alone does not prove that the service collects no technical data or that messages are private.', sources: [0, 2] },
      { heading: 'Assume a public message can be copied', content: 'A recipient can save, quote, photograph, or screenshot a message. Deleting or expiring a message in an app cannot prevent someone who already saw it from keeping a copy. Share only what you would be comfortable having repeated.' }
    ],
    sources: [
      { title: 'FTC: Heads Up — Stop. Think. Connect.', url: 'https://consumer.ftc.gov/articles/heads-up' },
      { title: 'CISA: Secure Our World — Four Easy Ways to Stay Safe Online (2024 tip sheet)', url: 'https://www.cisa.gov/sites/default/files/2024-09/Secure-Our-World-4-Easy-Ways-Stay-Safe-Online-Tip-Sheet.pdf' },
      { title: 'FTC: Data Security', url: 'https://consumer.ftc.gov/business-guidance/privacy-security/data-security' }
    ],
    relatedBlogs: ['how-to-talk-to-strangers-safely-online', 'ephemeral-messaging-guide-complete-privacy']
  },
  {
    slug: 'how-to-talk-to-strangers-safely-online',
    title: 'How to Chat with Strangers Online: A Safety Checklist',
    metaDescription: 'Use this practical online chat safety checklist: protect personal details, question urgent requests, and leave conversations that feel unsafe.',
    date: '2026-10-04',
    author: 'ChatHere Editorial Desk',
    category: 'Online safety',
    excerpt: 'A grounded checklist for safer conversations with people you do not know online, without promising that any platform can eliminate risk.',
    sections: [
      { heading: 'Keep identifying details out of public chat', content: 'Do not share passwords, one-time codes, payment information, your address, or live location with someone you have just met. Be cautious about details that can identify you when combined, such as a workplace, a small school program, and a precise neighborhood. The FTC warns that people online may not be who they claim to be and recommends protecting personal information.', sources: [0] },
      { heading: 'Recognize pressure and suspicious links', content: 'Requests for money, account access, private images, or fast decisions deserve extra scrutiny. Avoid opening unexpected links or attachments. If a message claims to come from someone or an organization you know, verify it independently instead of replying through the message.', sources: [0, 1] },
      { heading: 'Use the controls the service actually provides', content: 'Check whether the service offers reporting, blocking, moderation rules, or privacy controls, and learn how to use them before you need them. Do not assume that a text-only room is automatically moderated or risk-free. If a conversation becomes threatening, coercive, or uncomfortable, leave it and use available reporting tools.', sources: [2] },
      { heading: 'Remember the limits of anonymity', content: 'A display name is not the same thing as end-to-end encryption, verified anonymity, or protection from screenshots. In ChatHere, topic rooms are public: other participants can read messages while they are available. Avoid sharing sensitive information there.' }
    ],
    sources: [
      { title: 'FTC: Heads Up — Stop. Think. Connect.', url: 'https://consumer.ftc.gov/articles/heads-up' },
      { title: 'CISA: Secure Our World — Four Easy Ways to Stay Safe Online (2024 tip sheet)', url: 'https://www.cisa.gov/sites/default/files/2024-09/Secure-Our-World-4-Easy-Ways-Stay-Safe-Online-Tip-Sheet.pdf' },
      { title: 'Discord Safety Center', url: 'https://discord.com/safety' }
    ],
    relatedBlogs: ['online-privacy-checklist-anonymous-browsing', 'ephemeral-messaging-guide-complete-privacy']
  },
  {
    slug: 'ephemeral-messaging-guide-complete-privacy',
    title: 'Ephemeral Messaging: What It Can and Cannot Protect',
    metaDescription: 'Learn what temporary message storage can reduce, what it cannot prevent, and how ChatHere handles public-room messages.',
    date: '2026-10-04',
    author: 'ChatHere Editorial Desk',
    category: 'Messaging and privacy',
    excerpt: 'Message expiration can limit persistence, but it is not a guarantee of privacy, security, or erasure from every system and recipient device.',
    sections: [
      { heading: 'What “ephemeral” should mean', content: 'Ephemeral messaging describes messages intended to be temporary or not retained as a permanent chat history. The term alone does not tell you exactly when deletion occurs, whether service logs or backups exist, or whether recipients can preserve copies. Read the service’s own retention explanation rather than inferring a complete privacy guarantee from the label.', sources: [0] },
      { heading: 'How ChatHere handles room messages', content: 'In this repository’s chat implementation, room messages are kept in server memory for delivery and are not written by the chat application to a persistent message database. They can remain in memory until a server restart or storage-limit cleanup. This is not a promise that all operational data is absent, that every trace is immediately erased, or that other participants cannot copy messages. Public-room messages are visible to other participants.' },
      { heading: 'Temporary storage is only one privacy choice', content: 'The FTC’s security guidance recommends collecting only data a service needs, protecting it, and disposing of it securely when there is no longer a business need. That principle is broader than message expiration: account records, logs, analytics, and uploaded content may have separate retention rules.', sources: [0, 1] },
      { heading: 'What users should still do', content: 'Do not use a public chat as a place to send passwords, financial information, private images, or other sensitive details. A recipient may take a screenshot or otherwise record what they see. Choose an end-to-end encrypted service for conversations that require that protection, and verify its current documentation.' }
    ],
    sources: [
      { title: 'FTC: Data Security', url: 'https://consumer.ftc.gov/business-guidance/privacy-security/data-security' },
      { title: 'FTC: Start with Security — A Guide for Business', url: 'https://www.ftc.gov/business-guidance/resources/start-security-guide-business' }
    ],
    relatedBlogs: ['online-privacy-checklist-anonymous-browsing', 'how-to-talk-to-strangers-safely-online']
  },
  {
    slug: 'the-evolution-of-chat-rooms-from-irc-to-web3',
    title: 'A Short History of Internet Relay Chat and Online Chat Rooms',
    metaDescription: 'A concise, source-backed look at the IRC protocol, channels, and how browser-based chat differs from classic chat rooms.',
    date: '2026-10-04',
    author: 'ChatHere Editorial Desk',
    category: 'Internet history',
    excerpt: 'The 1993 IRC protocol documented nicknames, channels, and networked text chat. Here is what that history does—and does not—say about modern chat.',
    sections: [
      { heading: 'IRC was documented as a networked text protocol', content: 'Internet Relay Chat was described in RFC 1459, published in May 1993 by Jarkko Oikarinen and Darren Reed. The document explains clients, servers, nicknames, one-to-one messages, and channels that distribute messages to their members. The RFC is explicitly marked experimental and legacy, so it is useful as a historical technical document rather than a statement of current best practice.', sources: [0] },
      { heading: 'A chat room is a product model, not a privacy guarantee', content: 'A named room or channel helps organize conversations. It does not by itself tell users whether messages are public, encrypted, retained, moderated, or searchable. Those properties depend on the implementation and service policy, not the room metaphor.' },
      { heading: 'Modern browsers have a standard for live connections', content: 'The WebSocket API gives web pages a way to open a two-way connection to a server. That is one browser technology used for real-time applications; it does not make an application decentralized, private, or secure by itself.', sources: [1] },
      { heading: 'How ChatHere fits', content: 'ChatHere is a browser-based service with public rooms organized by topic. It uses Socket.IO for live messaging. Unlike the old “Web3” phrasing previously used in this article, this project does not claim to be a blockchain or decentralized chat service.' }
    ],
    sources: [
      { title: 'IETF Datatracker: RFC 1459, Internet Relay Chat Protocol', url: 'https://datatracker.ietf.org/doc/rfc1459/' },
      { title: 'MDN: The WebSocket API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API' }
    ],
    relatedBlogs: ['ephemeral-messaging-guide-complete-privacy']
  },
  {
    slug: 'psychology-of-online-anonymity-benefits',
    title: 'Online Disinhibition: What the Research Says—and Does Not Say',
    metaDescription: 'A careful introduction to John Suler’s online disinhibition theory and why it does not prove that anonymous chat improves mental health.',
    date: '2026-10-04',
    author: 'ChatHere Editorial Desk',
    category: 'Online communication research',
    excerpt: 'Online anonymity can affect how people communicate, but the research does not establish that anonymous chat is therapeutic or always beneficial.',
    sections: [
      { heading: 'What the online disinhibition effect describes', content: 'Psychologist John Suler’s 2004 paper describes how some people self-disclose or act out more frequently or intensely online than they would face to face. It discusses multiple interacting factors, including dissociative anonymity, invisibility, asynchronicity, and reduced authority cues. The paper presents a framework for understanding behavior, not proof that anonymity reliably creates trust or wellbeing.', sources: [0] },
      { heading: 'Disinhibition can have different outcomes', content: 'Less restraint can accompany self-disclosure, but it can also accompany hostile or harmful behavior. The paper does not support a universal claim that anonymous conversations are safer, more empathetic, therapeutic, or better for people with social anxiety. Outcomes depend on people and context.' },
      { heading: 'Use the idea carefully', content: 'It is reasonable to say that online settings can change how some people communicate. It is not reasonable to treat that observation as a mental-health intervention or a guarantee about an individual chat room. ChatHere is a social chat service, not counseling or crisis support.' },
      { heading: 'A note on this summary', content: 'This page summarizes the scope of one scholarly paper. It is not a systematic review of the wider research literature and should not be used as clinical advice.' }
    ],
    sources: [
      { title: 'Suler, “The Online Disinhibition Effect,” CyberPsychology & Behavior (2004)', url: 'https://journals.sagepub.com/doi/abs/10.1089/1094931041291295' }
    ],
    relatedBlogs: ['how-to-talk-to-strangers-safely-online']
  },
  {
    slug: 'discord-vs-anonymous-rooms-community-comparison',
    title: 'Discord or a Public Chat Room? Compare the Format Before You Choose',
    metaDescription: 'A source-backed format comparison: Discord servers offer persistent community tools, while ChatHere provides public topic-based rooms without account signup.',
    date: '2026-10-04',
    author: 'ChatHere Editorial Desk',
    category: 'Format comparison',
    excerpt: 'Compare the services by community structure, account model, message retention, and privacy controls using each product’s own documentation.',
    sections: [
      { heading: 'The products organize conversation differently', content: 'Discord documents servers with text, voice, and other channel types, plus configurable roles and permissions. ChatHere is simpler: visitors enter public text rooms organized by topic, without creating an account. These formats suit different needs; this is not a claim that one is universally better.', sources: [0] },
      { heading: 'Account model and persistence', content: 'Discord’s official signup guide describes creating an account to use its services. Its retention documentation explains that messages and other information can be retained under stated periods and purposes. ChatHere does not require an account to join a room; messages are held in server memory for delivery and may remain until restart or storage-limit cleanup. Neither account signup nor temporary message storage alone determines a service’s total privacy.', sources: [1, 2] },
      { heading: 'Privacy and safety need their own comparison', content: 'Discord publishes privacy controls, retention details, and safety resources. Read those current materials alongside ChatHere’s privacy page and community rules before deciding. ChatHere rooms are public and are not end-to-end encrypted private messaging. Do not assume either service is risk-free.', sources: [2, 3] },
      { heading: 'A quick way to choose', content: 'Consider Discord if you want persistent servers, channels, voice/video features, and community-management tools. Consider ChatHere if you want to enter a public topic room without making an account. If you need durable records, private messaging, or stronger confidentiality, review the relevant product documentation and select a service designed for that requirement.' }
    ],
    sources: [
      { title: 'Discord Support: Server Setup Guide', url: 'https://support.discord.com/hc/en-us/articles/33023827550359-Discord-Server-Setup-Guide' },
      { title: 'Discord Support: Sign-Up and Registration Guide', url: 'https://support.discord.com/hc/en-us/articles/31676852332439-Discord-Sign-Up-and-Registration-Guide' },
      { title: 'Discord Support: How long Discord keeps your information', url: 'https://support.discord.com/hc/en-us/articles/5431812448791-How-long-Discord-keeps-your-information' },
      { title: 'Discord Safety: Privacy Hub', url: 'https://discord.com/safety-privacy' }
    ],
    relatedBlogs: ['ephemeral-messaging-guide-complete-privacy', 'online-privacy-checklist-anonymous-browsing']
  }
];
