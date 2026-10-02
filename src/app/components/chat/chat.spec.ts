import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Chat } from './chat';
import { Group } from '../../services/group';
import { SocketService } from '../../services/socket';

describe('Chat channels', () => {
  it('switches rooms from the route and reuses member requests and admin creation', () => {
    const params = new BehaviorSubject(convertToParamMap({groupTitle: 'Study', channelName: 'chat'}));
    const group = {title: 'Study', members: ['alice'], admins: ['bob'], minimumAge: 18};
    const groups = {
      getGroup: () => of([group]),
      getChannels: () => of([{_id: 'one', groupTitle: 'Study', name: 'chat'}, {_id: 'two', groupTitle: 'Study', name: 'second'}]),
      requestChannel: vi.fn(() => of({message: 'Request sent'})),
      createChannel: vi.fn(() => of({message: 'Channel created'})),
    };
    const socket: any = {};
    for (const name of ['initSocket', 'disconnect', 'connect', 'joinChannel', 'onMessage', 'onHistory',
      'onJoined', 'onLeft', 'onError', 'onDeleted', 'onUserDeleted', 'onThemeChanged', 'onNotification', 'onConnected']) {
      socket[name] = vi.fn();
    }
    localStorage.setItem('currentUser', JSON.stringify({username: 'alice', age: 25}));
    TestBed.configureTestingModule({providers: [
      {provide: ActivatedRoute, useValue: {paramMap: params}},
      {provide: Router, useValue: {navigate: vi.fn()}},
      {provide: Group, useValue: groups}, {provide: SocketService, useValue: socket},
    ]});
    const chat = TestBed.runInInjectionContext(() => new Chat(TestBed.inject(ActivatedRoute), TestBed.inject(Router)));
    chat.ngOnInit();
    expect(chat.channels().length).toBe(2);
    chat.newChannelName = 'help';
    chat.saveChannel();
    expect(groups.requestChannel).toHaveBeenCalledWith({name: 'help', groupTitle: 'Study', requestedBy: 'alice'});
    group.admins.push('alice');
    chat.newChannelName = 'announcements';
    chat.saveChannel();
    expect(groups.createChannel).toHaveBeenCalledWith('announcements', 'Study', 'alice');
    chat.messageText = 'Old room draft';
    params.next(convertToParamMap({groupTitle: 'Study', channelName: 'second'}));
    expect(chat.channelName).toBe('second');
    expect(chat.messageText).toBe('');
    expect(socket.connect).toHaveBeenCalledTimes(2);
    chat.ngOnDestroy();
    localStorage.removeItem('currentUser');
  });
});
