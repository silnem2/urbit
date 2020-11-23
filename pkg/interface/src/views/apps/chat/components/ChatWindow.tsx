import React, { Component } from "react";
import { RouteComponentProps } from "react-router-dom";
import _ from "lodash";
import bigInt, { BigInteger } from 'big-integer';

import GlobalApi from "~/logic/api/global";
import { Patp, Path } from "~/types/noun";
import { Contacts } from "~/types/contact-update";
import { Association } from "~/types/metadata-update";
import { Group } from "~/types/group-update";
import { Envelope, IMessage } from "~/types/chat-update";
import { LocalUpdateRemoteContentPolicy, Graph } from "~/types";
import { BigIntOrderedMap } from "~/logic/lib/BigIntOrderedMap";

import VirtualScroller from "~/views/components/VirtualScroller";

import ChatMessage, { MessagePlaceholder } from './ChatMessage';
import { UnreadNotice } from "./unread-notice";
import { ResubscribeElement } from "./resubscribe-element";
import { BacklogElement } from "./backlog-element";

const INITIAL_LOAD = 20;
const DEFAULT_BACKLOG_SIZE = 100;
const IDLE_THRESHOLD = 64;
const MAX_BACKLOG_SIZE = 1000;

type ChatWindowProps = RouteComponentProps<{
  ship: Patp;
  station: string;
}> & {
  unreadCount: number;
  isChatMissing: boolean;
  isChatLoading: boolean;
  isChatUnsynced: boolean;
  unreadMsg: Envelope | false;
  stationPendingMessages: IMessage[];
  graph: Graph;
  contacts: Contacts;
  association: Association;
  group: Group;
  ship: Patp;
  station: any;
  api: GlobalApi;
  hideNicknames: boolean;
  hideAvatars: boolean;
  remoteContentPolicy: LocalUpdateRemoteContentPolicy;
  scrollTo?: number;
}

interface ChatWindowState {
  fetchPending: boolean;
  idle: boolean;
  initialized: boolean;
  lastRead: number;
}

export default class ChatWindow extends Component<ChatWindowProps, ChatWindowState> {
  private virtualList: VirtualScroller | null;
  private unreadMarkerRef: React.RefObject<HTMLDivElement>;
  private prevSize = 0;
  private loadedNewest = false;
  private loadedOldest = false;

  INITIALIZATION_MAX_TIME = 1500;

  constructor(props) {
    super(props);

    this.state = {
      fetchPending: false,
      idle: true,
      initialized: false,
      lastRead: props.unreadCount ? props.mailboxSize - props.unreadCount : -1,
    };

    this.dismissUnread = this.dismissUnread.bind(this);
    this.scrollToUnread = this.scrollToUnread.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.stayLockedIfActive = this.stayLockedIfActive.bind(this);
    this.dismissIfLineVisible = this.dismissIfLineVisible.bind(this);

    this.virtualList = null;
    this.unreadMarkerRef = React.createRef();
    this.prevSize = props.graph.size;
  }

  componentDidMount() {
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    setTimeout(() => {
      if(this.props.scrollTo) {
        this.scrollToUnread();
      }

      this.setState({ initialized: true });
    }, this.INITIALIZATION_MAX_TIME);
  }

  componentWillUnmount() {
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
  }

  handleWindowBlur() {
    this.setState({ idle: true });
  }

  handleWindowFocus() {
    this.setState({ idle: false });
    if (this.virtualList?.window?.scrollTop === 0) {
      this.dismissUnread();
    }
  }

  componentDidUpdate(prevProps: ChatWindowProps, prevState) {
    const { isChatMissing, history, graph, unreadCount, station } = this.props;

    if (isChatMissing) {
      history.push("/~404");
    } else if (graph.size !== prevProps.graph.size && this.state.fetchPending) {
      this.setState({ fetchPending: false });
    }

      /*if ((mailboxSize !== prevProps.mailboxSize) || (envelopes.length !== prevProps.envelopes.length)) {
      this.virtualList?.calculateVisibleItems();
      this.stayLockedIfActive();
    }*/

      /*if (unreadCount > prevProps.unreadCount && this.state.idle) {
      this.setState({
        lastRead: unreadCount ? mailboxSize - unreadCount : -1,
      });
    }*/

    if(this.prevSize !== graph.size) {
      this.prevSize = graph.size;
      this.virtualList?.calculateVisibleItems();
    }
      /*
    if (stationPendingMessages.length !== prevProps.stationPendingMessages.length) {
      this.virtualList?.calculateVisibleItems();
    }

    if (!this.state.fetchPending && prevState.fetchPending) {
      this.virtualList?.calculateVisibleItems();
    }

    if (station !== prevProps.station) {
      this.virtualList?.resetScroll();
      this.scrollToUnread();
      this.setState({
        lastRead: unreadCount ? mailboxSize - unreadCount : -1,
      });
    }
     */
  }

  stayLockedIfActive() {
    if (this.virtualList && !this.state.idle) {
      this.virtualList.resetScroll();
      this.dismissUnread();
    }
  }

  scrollToUnread() {
    /*
    const { mailboxSize, unreadCount, scrollTo } = this.props;
    const target = scrollTo || (mailboxSize - unreadCount);
    this.virtualList?.scrollToData(target);
     */
  }

  dismissUnread() {
    if (this.state.fetchPending) return;
    if (this.props.unreadCount === 0) return;
    //this.props.api.chat.read(this.props.station);
    //this.props.api.hark.readIndex({ chat: { chat: this.props.station, mention: false }});
  }

  async fetchMessages(newer: boolean, force = false): Promise<void> {
    const { api, station, graph } = this.props;

    if ( this.state.fetchPending && !force) {
     return new Promise((resolve, reject) => {});
    }

    this.setState({ fetchPending: true });

    const [,, ship, name] = station.split('/');
    const currSize = graph.size;
    if(newer && !this.loadedNewest) {
      const [index] = graph.peekLargest()!;
      await api.graph.getYoungerSiblings(ship,name, 5, `/${index.toString()}`)
      if(currSize === graph.size) {
        console.log('loaded all newest');
        this.loadedNewest = true;
      }
    } else if(!newer && !this.loadedOldest) {
      const [index] = graph.peekSmallest()!;
      await api.graph.getOlderSiblings(ship,name, 5, `/${index.toString()}`)
      if(currSize === graph.size) {
        console.log('loaded all oldest');
        this.loadedOldest = true;
      }
    }
    this.setState({ fetchPending: false });

  }

  onScroll({ scrollTop, scrollHeight, windowHeight }) {
    if (!this.state.idle && scrollTop > IDLE_THRESHOLD) {
      this.setState({ idle: true });
    }

    this.dismissIfLineVisible();
  }

  dismissIfLineVisible() {
    if (this.props.unreadCount === 0) return;
    if (!this.unreadMarkerRef.current || !this.virtualList?.window) return;
    const parent = this.unreadMarkerRef.current.parentElement?.parentElement;
    if (!parent) return;
    const { scrollTop, scrollHeight, offsetHeight } = this.virtualList.window;
    if (
      (scrollHeight - parent.offsetTop > scrollTop)
      && (scrollHeight - parent.offsetTop < scrollTop + offsetHeight)
    ) {
      this.dismissUnread();
    }
  }

  render() {
    const {
      stationPendingMessages,
      unreadCount,
      unreadMsg,
      isChatLoading,
      isChatUnsynced,
      api,
      ship,
      station,
      association,
      group,
      contacts,
      mailboxSize,
      graph,
      hideAvatars,
      hideNicknames,
      remoteContentPolicy,
      history
    } = this.props;

    const unreadMarkerRef = this.unreadMarkerRef;

    let lastMessage = 0;

    const messageProps = { association, group, contacts, hideAvatars, hideNicknames, remoteContentPolicy, unreadMarkerRef, history, api };

    const keys = graph.keys().reverse();

    return (
      <>
        <UnreadNotice
          unreadCount={unreadCount}
          unreadMsg={unreadCount === 1 && unreadMsg && unreadMsg.author === window.ship ? false : unreadMsg}
          dismissUnread={this.dismissUnread}
          onClick={this.scrollToUnread}
        />
        <BacklogElement isChatLoading={isChatLoading} />
        <ResubscribeElement {...{ api, host: ship, station, isChatUnsynced}} />
        <VirtualScroller
          ref={list => {this.virtualList = list}}
          origin="bottom"
          style={{ height: '100%' }}
          onStartReached={() => {
            this.setState({ idle: false });
            this.dismissUnread();
          }}
          onScroll={this.onScroll.bind(this)}
          data={graph}
          size={graph.size}
          renderer={({ index, measure, scrollWindow }) => {
            const msg = graph.get(index)!.post;
            if (!msg) return null;
            if (!this.state.initialized) {
              return <MessagePlaceholder key={index.toString()} height="64px" index={index} />;
            }
            const isPending: boolean = 'pending' in msg && Boolean(msg.pending);
            const isLastMessage: boolean = Boolean(index.eq(bigInt(lastMessage)));
            const isLastRead: boolean = Boolean(!isLastMessage && index.eq(bigInt(this.state.lastRead)));
            const highlighted = bigInt(this.props.scrollTo || -1).eq(index);
            const props = { measure, highlighted, scrollWindow, isPending, isLastRead, isLastMessage, msg, ...messageProps };
            const graphIdx = keys.findIndex(idx => idx.eq(index));
            const prevIdx = keys[graphIdx+1];
            const nextIdx = keys[graphIdx-1];
            return (
              <ChatMessage
                key={index.toString()}
                previousMsg={prevIdx && graph.get(prevIdx)?.post}
                nextMsg={nextIdx && graph.get(nextIdx)?.post}
                {...props}
              />
            );
          }}
          loadRows={(newer) => {
            this.fetchMessages(newer);
          }}
        />
      </>
    );
  }
}

