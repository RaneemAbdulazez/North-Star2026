export interface WisdomItem {
    id: string;
    title: string;
    author: string;
    type: "TedTalk" | "Podcast" | "Article" | "Book";
    category: "Focus & Clarity" | "Financial Mindset" | "Mental Models";
    link_url: string;
    description: string;
    duration: string;
    tag: "Perfect for Gym" | "Evening Deep Dive" | "Quick Win";
}

export const wisdomLibrary: WisdomItem[] = [
    {
        id: "1",
        title: "Inside the mind of a master procrastinator",
        author: "Tim Urban",
        type: "TedTalk",
        category: "Focus & Clarity",
        link_url: "https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator",
        description: "An hilarious and insightful look into why we wait until the last minute. The Instant Gratification Monkey is real.",
        duration: "14 min",
        tag: "Quick Win"
    },
    {
        id: "2",
        title: "The Psychology of Money",
        author: "Morgan Housel",
        type: "Book",
        category: "Financial Mindset",
        link_url: "https://www.amazon.com/Psychology-Money-Timeless-lessons-happiness/dp/0857197681",
        description: "Doing well with money isn't necessarily about what you know. It's about how you behave.",
        duration: "Book",
        tag: "Evening Deep Dive"
    },
    {
        id: "3",
        title: "How to Be Successful",
        author: "Sam Altman",
        type: "Article",
        category: "Mental Models",
        link_url: "https://blog.samaltman.com/how-to-be-successful",
        description: "A comprehensive guide on compounding, self-belief, and hard work from the CEO of OpenAI.",
        duration: "10 min read",
        tag: "Quick Win"
    },
    {
        id: "4",
        title: "Deep Work",
        author: "Cal Newport",
        type: "Book",
        category: "Focus & Clarity",
        link_url: "https://www.calnewport.com/books/deep-work/",
        description: "Rules for focused success in a distracted world. Learn how to master hard things quickly.",
        duration: "Book",
        tag: "Evening Deep Dive"
    },
    {
        id: "5",
        title: "Naval Ravikant on Wealth & Happiness",
        author: "Naval Ravikant",
        type: "Podcast",
        category: "Mental Models",
        link_url: "https://nav.al/rich",
        description: "Seek wealth, not money or status. Wealth is having assets that earn while you sleep.",
        duration: "3h 30m",
        tag: "Perfect for Gym"
    },
    {
        id: "6",
        title: "Atomic Habits",
        author: "James Clear",
        type: "Book",
        category: "Focus & Clarity",
        link_url: "https://jamesclear.com/atomic-habits",
        description: "Tiny changes, remarkable results. How 1% improvements every day lead to massive transformation.",
        duration: "Book",
        tag: "Evening Deep Dive"
    },
    {
        id: "7",
        title: "The Tail End",
        author: "Tim Urban",
        type: "Article",
        category: "Mental Models",
        link_url: "https://waitbutwhy.com/2015/12/the-tail-end.html",
        description: "A visual check-in on how much time you actually have left with the people you love.",
        duration: "5 min read",
        tag: "Quick Win"
    },
    {
        id: "8",
        title: "Wealth",
        author: "Paul Graham",
        type: "Article",
        category: "Financial Mindset",
        link_url: "http://www.paulgraham.com/wealth.html",
        description: "The best way to get rich is to start a startup. But what IS wealth?",
        duration: "15 min read",
        tag: "Evening Deep Dive"
    },
    {
        id: "9",
        title: "Sleep is your Superpower",
        author: "Matt Walker",
        type: "TedTalk",
        category: "Focus & Clarity",
        link_url: "https://www.ted.com/talks/matt_walker_sleep_is_your_superpower",
        description: "Sleep is the single most effective thing we can do to reset our brain and body health each day.",
        duration: "19 min",
        tag: "Quick Win"
    },
    {
        id: "10",
        title: "The Almanack of Naval Ravikant",
        author: "Eric Jorgenson",
        type: "Book",
        category: "Mental Models",
        link_url: "https://www.navalmanack.com/",
        description: "A guide to wealth and happiness. Collected wisdom from one of the world's greatest thinkers.",
        duration: "Book",
        tag: "Evening Deep Dive"
    },
    {
        id: "11",
        title: "Financial Independence",
        author: "Mr. Money Mustache",
        type: "Article",
        category: "Financial Mindset",
        link_url: "https://www.mrmoneymustache.com/2012/01/13/the-shockingly-simple-math-behind-early-retirement/",
        description: "The math behind early retirement is shockingly simple. It's safe withdrawal rates.",
        duration: "8 min read",
        tag: "Quick Win"
    },
    {
        id: "12",
        title: "Why we do what we do",
        author: "Tony Robbins",
        type: "TedTalk",
        category: "Mental Models",
        link_url: "https://www.ted.com/talks/tony_robbins_why_we_do_what_we_do",
        description: "What drives your actions? Tony Robbins discusses the 'invisible forces' that motivate everyone.",
        duration: "21 min",
        tag: "Perfect for Gym"
    },
    {
        id: "13",
        title: "Maker's Schedule, Manager's Schedule",
        author: "Paul Graham",
        type: "Article",
        category: "Focus & Clarity",
        link_url: "http://www.paulgraham.com/makersschedule.html",
        description: "Why programmers hate meetings. One meeting can blow a whole afternoon of deep work.",
        duration: "10 min read",
        tag: "Quick Win"
    },
    {
        id: "14",
        title: "Principles",
        author: "Ray Dalio",
        type: "Book",
        category: "Mental Models",
        link_url: "https://www.principles.com/",
        description: "Principles are fundamental truths that serve as the foundations for behavior that gets you what you want.",
        duration: "Book",
        tag: "Evening Deep Dive"
    },
    {
        id: "15",
        title: "Rich Dad Poor Dad",
        author: "Robert Kiyosaki",
        type: "Book",
        category: "Financial Mindset",
        link_url: "https://www.amazon.com/Rich-Dad-Poor-Teach-Middle/dp/1612680194",
        description: "The difference between working for money and having your money work for you.",
        duration: "Book",
        tag: "Evening Deep Dive"
    }
];
