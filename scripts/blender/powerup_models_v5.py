"""Revision 5 geometry for the 18Bro Magnet and Moon Boots."""


def make_builders(Shape, matrix, Matrix, math, COLORS):
    def rgb(value):
        return tuple(int(value[i:i+2],16)/255 for i in (1,3,5))+(1,)
    COLORS.update({'ear_red':rgb('#b52f3e'),'ear_green':rgb('#126148'),'pole_gray':rgb('#b7bcc5')})

    def build_magnet():
        s=Shape('magnet')
        left=[(-.40,0,.56),(-.40,0,.36),(-.37,0,.18),(-.29,0,.03),(-.16,0,-.09),(0,0,-.14)]
        right=[(0,0,-.14),(.16,0,-.09),(.29,0,.03),(.37,0,.18),(.40,0,.36),(.40,0,.56)]
        s.tube(left,.145,'speed_blue',sides=10)
        s.tube(right,.145,'coral',sides=10)
        for side in (-1,1):
            s.rounded_box((side*.40,0,.545),(.286,.286,.245),'pole_gray',.045)
        s.prism([(-.08,.70),(.07,.70),(-.01,.87),(.16,.87),(-.11,1.17),
                 (-.04,.94),(-.20,.94)],.105,'gold',y=-.03,bevel=.016)
        obj=s.finish()
        obj['design_revision']=5
        obj['magnet_halves']='left_blue_right_red'
        obj['pole_ends']='aligned_gray'
        obj['gold_zap_count']=1
        obj['side_zap_count']=0
        return obj

    def add_moon_sneaker(s, arrow_color, transform=None):
        # Tapered tread, raised midsole and sculpted upper form an original
        # court-sneaker silhouette: broad toe, pinched waist and firm heel.
        s.loft([(-.120,.168,.278,0,-.075,.62),(-.095,.181,.294,0,-.078,.66),
                (-.070,.181,.294,0,-.078,.66)],'rubber',12,False,transform)
        s.loft([(-.071,.176,.287,0,-.078,.64),(-.040,.182,.292,0,-.080,.67),
                (-.012,.173,.278,0,-.074,.69)],'cream',12,False,transform)
        s.loft([(-.012,.164,.263,0,-.080,.70),(.038,.168,.255,0,-.074,.72),
                (.100,.158,.214,0,-.040,.76),(.166,.146,.174,0,.006,.79),
                (.226,.137,.151,0,.030,.80)],'lime',12,True,transform)
        s.ellipsoid((0,-.304,.020),(.145,.034,.052),'mint',12,4,transform)
        s.prism([(-.142,.018),(-.118,.150),(0,.204),(.118,.150),(.142,.018),
                 (.090,.082),(0,.125),(-.090,.082)],.035,'teal',y=-.249,
                bevel=.008,transform=transform)
        local=transform or Matrix.Identity(4)
        tongue_tf=local @ matrix((0,-.222,.116),(.18,0,0))
        s.rounded_box((0,0,0),(.196,.044,.255),'teal_dark',.020,tongue_tf)
        # Open padded collar accepts the ankle rather than capping through it.
        first_face=len(s.faces)
        s.loft([(.178,.148,.158,0,.030,.78),(.242,.150,.160,0,.030,.78),
                (.275,.142,.151,0,.030,.78),(.275,.119,.127,0,.030,.78),
                (.225,.119,.127,0,.030,.78)],'teal',12,True,transform)
        del s.faces[-2:]; del s.colors[-2:]; del s.smoothing[-2:]
        for i in range(first_face+36,min(first_face+48,len(s.colors))):
            s.colors[i]=COLORS['teal_dark']
        for i in range(4):
            z=.072+i*.039
            y=-.294+i*.030
            s.tube([(-.092,y+.018,z),(0,y,z+.007),(.092,y+.018,z)],
                   .012,'ivory',6,transform)
        # Thick upward arrow stays contained by the layered heel counter.
        s.rounded_box((0,.182,.086),(.285,.050,.220),'teal_dark',.025,transform)
        arrow=[(-.070,-.002),(-.070,.088),(-.125,.088),(0,.222),
               (.125,.088),(.070,.088),(.070,-.002)]
        outline=[(x*1.18,(z-.105)*1.18+.105) for x,z in arrow]
        s.prism(outline,.040,'cream',y=.218,bevel=.008,transform=transform)
        s.prism(arrow,.032,arrow_color,y=.243,bevel=.007,transform=transform)


    def build_moon():
        s=Shape('moon')
        for side in (-1,1):
            tf=matrix((side*.285,.055 if side<0 else -.055,
                       .015 if side<0 else -.020),
                      (0,side*-.075,side*-.16),(1.42,1.42,1.42))
            add_moon_sneaker(s,'ear_green' if side<0 else 'ear_red',tf)
        obj=s.finish()
        obj['design_revision']=5
        obj['silhouette']='original_mid_top_court_sneakers'
        obj['rear_wing_count']=0
        obj['heel_arrows']='left_green_right_red'
        return obj

    def build_wearable_magnet():
        s=Shape('wearable_magnet')
        left=[(-.245,-.080,.475),(-.245,-.080,.290),(-.220,-.080,.170),
              (-.155,-.080,.070),(0,-.080,.010)]
        right=[(0,-.080,.010),(.155,-.080,.070),(.220,-.080,.170),
               (.245,-.080,.290),(.245,-.080,.475)]
        s.tube(left,.090,'speed_blue',sides=10)
        s.tube(right,.090,'coral',sides=10)
        for side in (-1,1):
            s.rounded_box((side*.245,-.080,.455),(.180,.180,.155),'pole_gray',.027)
        s.prism([(-.045,.500),(.050,.500),(-.005,.570),(.092,.570),
                 (-.072,.675),(-.030,.605),(-.118,.605)],
                .055,'gold',y=-.105,bevel=.008)
        # Keep the lower bridge within the established paw-grip pivot tolerance.
        s.vertices=[(x,y,z+.025) for x,y,z in s.vertices]
        obj=s.finish(name='wearable_magnet',normalize=False,
                     origin_contract='paw_grip_origin; glTF_Y_up; front_+Z; units_meters')
        obj['design_revision']=5
        obj['magnet_halves']='left_blue_right_red'
        obj['pole_ends']='aligned_gray'
        obj['gold_zap_count']=1
        obj['side_zap_count']=0
        return obj

    def build_wearable_moon(label):
        s=Shape('wearable_moon_'+label)
        add_moon_sneaker(s,'ear_green' if label=='L' else 'ear_red')
        obj=s.finish(name='wearable_moon_'+label,normalize=False,
                     origin_contract='ankle_pivot_origin; glTF_Y_up; toe_+Z; sole_Y_minus_0_12; units_meters')
        obj['design_revision']=5
        obj['shoe_style']='original_mid_top_court_sneaker'
        obj['rear_wing_count']=0
        obj['heel_arrow']='green' if label=='L' else 'red'
        return obj

    return build_magnet,build_moon,build_wearable_magnet,build_wearable_moon
